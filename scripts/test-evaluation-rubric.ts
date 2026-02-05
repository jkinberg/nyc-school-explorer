/**
 * Test script for evaluation rubric accuracy.
 *
 * Sends sample queries to the chat API and reports on evaluation scores,
 * specifically looking for false positives in factual accuracy.
 *
 * Usage:
 *   npx tsx scripts/test-evaluation-rubric.ts [BASE_URL]
 *
 * Example:
 *   npx tsx scripts/test-evaluation-rubric.ts https://nyc-school-explorer-xxx.run.app
 *   npx tsx scripts/test-evaluation-rubric.ts http://localhost:3000
 */

interface EvaluationResult {
  scores: {
    factual_accuracy: number;
    context_inclusion: number;
    limitation_acknowledgment: number;
    responsible_framing: number;
    query_relevance: number;
  };
  flags: string[];
  summary: string;
  weighted_score: number;
}

interface TestResult {
  query: string;
  description: string;
  responseSnippet: string;
  evaluation: EvaluationResult | null;
  factualAccuracyScore: number | null;
  flags: string[];
  passed: boolean;
  error?: string;
}

// Test queries designed to exercise the evaluation rubric
const TEST_QUERIES = [
  {
    query: "What high-poverty schools are outperforming expectations?",
    description: "Tests Impact Score median (0.50) and year availability (2 years)",
    expectedFacts: ["median 0.50", "2 years of Impact data", "ENI >= 0.85"]
  },
  {
    query: "What is the correlation between poverty and test scores?",
    description: "Tests correlation values (r=-0.69 for Performance, r=-0.29 for Impact)",
    expectedFacts: ["r = -0.69", "r = -0.29", "Performance Score", "Impact Score"]
  },
  {
    query: "How many high-growth schools are there?",
    description: "Tests school counts and category thresholds",
    expectedFacts: ["Impact >= 0.55", "category"]
  },
  {
    query: "Tell me about P.S. 188 The Island School",
    description: "Tests school profile with scores and context",
    expectedFacts: ["Impact", "Performance", "ENI"]
  },
  {
    query: "Which schools maintained high growth for both years?",
    description: "Tests persistent high growth definition",
    expectedFacts: ["2023-24", "2024-25", "persistent", "both years"]
  },
  {
    query: "What's the difference between Impact Score and Performance Score?",
    description: "Tests metric explanations and correlation facts",
    expectedFacts: ["student growth", "absolute outcomes", "poverty", "correlation"]
  },
  {
    query: "Show me schools in Brooklyn with the highest student growth",
    description: "Tests sorting and Impact Score interpretation",
    expectedFacts: ["Impact", "Brooklyn", "growth"]
  },
  {
    query: "What schools have improving test scores despite high poverty?",
    description: "Tests high-poverty threshold and growth framing",
    expectedFacts: ["ENI", "0.85", "Impact"]
  }
];

async function parseSSEStream(response: Response): Promise<{
  fullResponse: string;
  evaluation: EvaluationResult | null;
}> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullResponse = '';
  let evaluation: EvaluationResult | null = null;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        const eventType = line.slice(7);
        continue;
      }
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.text) {
            fullResponse += data.text;
          }
          if (data.scores && data.weighted_score !== undefined) {
            evaluation = data as EvaluationResult;
          }
        } catch {
          // Ignore parse errors for non-JSON data lines
        }
      }
    }
  }

  return { fullResponse, evaluation };
}

async function runQuery(baseUrl: string, query: string): Promise<{
  response: string;
  evaluation: EvaluationResult | null;
  error?: string;
}> {
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: query }]
      })
    });

    if (!response.ok) {
      return {
        response: '',
        evaluation: null,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const { fullResponse, evaluation } = await parseSSEStream(response);
    return { response: fullResponse, evaluation };
  } catch (error) {
    return {
      response: '',
      evaluation: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function runTests(baseUrl: string): Promise<TestResult[]> {
  const results: TestResult[] = [];

  console.log(`\n🧪 Testing evaluation rubric against: ${baseUrl}\n`);
  console.log('='.repeat(70));

  for (const test of TEST_QUERIES) {
    console.log(`\n📝 Query: "${test.query}"`);
    console.log(`   Purpose: ${test.description}`);

    const { response, evaluation, error } = await runQuery(baseUrl, test.query);

    if (error) {
      console.log(`   ❌ Error: ${error}`);
      results.push({
        query: test.query,
        description: test.description,
        responseSnippet: '',
        evaluation: null,
        factualAccuracyScore: null,
        flags: [],
        passed: false,
        error
      });
      continue;
    }

    const snippet = response.slice(0, 200).replace(/\n/g, ' ') + '...';
    console.log(`   Response: ${snippet}`);

    if (evaluation) {
      const factualScore = evaluation.scores.factual_accuracy;
      const flags = evaluation.flags || [];
      const passed = factualScore >= 4 && flags.length === 0;

      console.log(`   📊 Factual Accuracy: ${factualScore}/5`);
      console.log(`   📊 Weighted Score: ${evaluation.weighted_score}/100`);

      if (flags.length > 0) {
        console.log(`   🚩 Flags:`);
        flags.forEach(f => console.log(`      - ${f}`));
      }

      console.log(`   ${passed ? '✅ PASSED' : '⚠️  REVIEW NEEDED'}`);

      results.push({
        query: test.query,
        description: test.description,
        responseSnippet: snippet,
        evaluation,
        factualAccuracyScore: factualScore,
        flags,
        passed
      });
    } else {
      console.log(`   ⚠️  No evaluation returned`);
      results.push({
        query: test.query,
        description: test.description,
        responseSnippet: snippet,
        evaluation: null,
        factualAccuracyScore: null,
        flags: [],
        passed: false,
        error: 'No evaluation returned'
      });
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return results;
}

function printSummary(results: TestResult[]) {
  console.log('\n' + '='.repeat(70));
  console.log('📋 SUMMARY');
  console.log('='.repeat(70));

  const withEval = results.filter(r => r.evaluation !== null);
  const passed = results.filter(r => r.passed);
  const withFlags = results.filter(r => r.flags.length > 0);

  console.log(`\nTotal queries: ${results.length}`);
  console.log(`Evaluations received: ${withEval.length}`);
  console.log(`Passed (factual >= 4, no flags): ${passed.length}`);
  console.log(`With flags (potential false positives): ${withFlags.length}`);

  if (withEval.length > 0) {
    const avgFactual = withEval.reduce((sum, r) => sum + (r.factualAccuracyScore || 0), 0) / withEval.length;
    const avgWeighted = withEval.reduce((sum, r) => sum + (r.evaluation?.weighted_score || 0), 0) / withEval.length;
    console.log(`\nAverage factual accuracy: ${avgFactual.toFixed(2)}/5`);
    console.log(`Average weighted score: ${avgWeighted.toFixed(1)}/100`);
  }

  if (withFlags.length > 0) {
    console.log('\n🚩 ALL FLAGS (potential false positives to review):');
    withFlags.forEach(r => {
      console.log(`\n  Query: "${r.query}"`);
      r.flags.forEach(f => console.log(`    - ${f}`));
    });
  }

  // Detailed breakdown
  console.log('\n📊 DETAILED SCORES:');
  console.log('-'.repeat(70));
  results.forEach(r => {
    const status = r.error ? '❌' : r.passed ? '✅' : '⚠️';
    const score = r.factualAccuracyScore !== null ? `${r.factualAccuracyScore}/5` : 'N/A';
    console.log(`${status} [Factual: ${score}] ${r.query.slice(0, 50)}...`);
  });
}

async function main() {
  const baseUrl = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';

  console.log('🔬 Evaluation Rubric Test Suite');
  console.log('================================');
  console.log(`Target: ${baseUrl}`);
  console.log(`Queries: ${TEST_QUERIES.length}`);

  const results = await runTests(baseUrl);
  printSummary(results);

  // Exit with error code if any tests failed
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
