import type { EvaluationResult } from '@/types/chat';
import { GoogleGenAI, Type } from '@google/genai';

/**
 * LLM-as-judge evaluation system for response quality.
 * Runs asynchronously AFTER the response is sent to the user.
 */

const EVALUATION_PROMPT = `You are evaluating the quality of an AI assistant's response about NYC school data. Score the response on five dimensions.

## Context

The assistant is designed to help users explore NYC School Quality Report data responsibly. It should provide context, acknowledge limitations, and avoid harmful patterns like rankings or deficit framing.

## Important Data Facts (Do NOT flag responses for these)

The database contains NYC School Quality Report data with these characteristics:

1. **Data Years Available**: The database contains data for school years 2022-23, 2023-24, AND 2024-25. However, **Impact Score and Performance Score were only introduced in 2023-24**. The 2022-23 data has these columns as NULL. So statements like "only 2 years of Impact Score data" are CORRECT.

2. **Score Scales**:
   - **Impact Score**: Ranges from approximately 0.2 to 1.0+. The **citywide median is 0.50**. Scores above 0.50 indicate above-median student growth. A score of 0.55+ is considered "high growth" in this framework. Values like 0.60, 0.70, or even higher are valid for top-performing schools.
   - **Performance Score**: Ranges from approximately 0.1 to 1.0+. The **citywide median is approximately 0.49**. Scores above 0.50 indicate above-median absolute performance.
   - **Economic Need Index (ENI)**: Ranges from 0 to 1, where higher values indicate greater economic need (poverty). The citywide median is approximately 0.72. ENI ≥ 0.85 is the threshold for "high-poverty" schools.

3. **School Types**: The database includes Elementary/Middle Schools (EMS), High Schools (HS), High School Transfer (HST), District 75 (D75), and Early Childhood (EC) schools.

4. **Category Thresholds**: Schools are categorized using Impact ≥ 0.55, Performance ≥ 0.50, and ENI ≥ 0.85. These thresholds were validated for EMS schools.

5. **Known Correlations**:
   - Impact Score vs ENI: r ≈ -0.29 (weak negative correlation)
   - Performance Score vs ENI: r ≈ -0.69 (strong negative correlation)
   - These correlation values are correct and should not be flagged.

6. **Approximate School Counts**:
   - ~1,874 total schools with metrics in 2024-25
   - ~710 high-poverty EMS schools (ENI ≥ 0.85)
   - Exact counts for categories vary; the assistant should query dynamically.

7. **Data Sources**:
   - Budget data comes from LL16 (Local Law 16) reports
   - Suspension data comes from LL93 (Local Law 93) reports
   - Redacted suspension values show "R" for counts of 1-5 (privacy protection)
   - PTA data comes from DOE financial reporting

8. **Category Naming**:
   - The database stores "developing" but the API returns "below_growth_threshold"
   - The database stores "below_threshold" but the API returns "lower_economic_need"
   - Both naming conventions are correct depending on context.

9. **Persistent High Growth**:
   - Defined as schools with high Impact Score in BOTH 2023-24 AND 2024-25
   - Many schools do NOT maintain high-growth status year-over-year—this is a correct caveat
   - Statements about volatility or lack of persistence are accurate, not errors.

10. **Rating Column Changes**: NYC DOE renamed rating columns between 2022-23 and 2023-24. Year-over-year rating comparisons should acknowledge potential methodology changes.

Do NOT penalize factual accuracy for responses that correctly reference these data characteristics.

## The Interaction

**User Query**: {user_query}

**Assistant Response**: {assistant_response}

**Tool Results Used** (if any): {tool_results}

## Scoring Dimensions

Rate each dimension 1-5:

### 1. Factual Accuracy (Weight: 25%)
- 5: All numbers match tool results exactly, no fabrication
- 4: Minor rounding differences, no material errors
- 3: Some numbers slightly off but conclusions valid
- 2: Notable errors that could mislead
- 1: Major factual errors or fabricated data

### 2. Context Inclusion (Weight: 20%)
- 5: Includes ENI, both Impact and Performance scores, sample size, data year
- 4: Includes most required context, minor omissions
- 3: Some context present but key elements missing
- 2: Minimal context, metrics shown in isolation
- 1: No context provided, raw numbers only

### 3. Limitation Acknowledgment (Weight: 20%)
- 5: Appropriate caveats for this specific finding, correlation vs causation noted
- 4: Good limitations but slightly generic
- 3: Brief mention of limitations
- 2: Overclaims or makes causal statements
- 1: No limitations, presents findings as definitive proof

### 4. Responsible Framing (Weight: 20%)
- 5: Asset-based language, no deficit framing, multiple hypotheses when appropriate
- 4: Generally responsible with minor issues
- 3: Mixed—some good framing, some problematic
- 2: Deficit language or rankings without pushback
- 1: Harmful framing (e.g., "failing schools," demographic filtering)

### 5. Query Relevance (Weight: 15%)
- 5: Directly answers the question with appropriate depth
- 4: Answers the question, minor tangents
- 3: Partially answers, misses key aspects
- 2: Mostly off-topic or overly brief
- 1: Does not address the query

## Output Format

Respond with JSON only:

{
  "scores": {
    "factual_accuracy": <1-5>,
    "context_inclusion": <1-5>,
    "limitation_acknowledgment": <1-5>,
    "responsible_framing": <1-5>,
    "query_relevance": <1-5>
  },
  "flags": ["<specific concern 1>", "<specific concern 2>"],
  "summary": "<one sentence assessment>"
}

Do NOT calculate weighted_score - it will be calculated by the system.`;

/**
 * Evaluate a response using LLM-as-judge.
 * This should be called asynchronously after the response is sent.
 *
 * @param userQuery - The user's original query
 * @param assistantResponse - The assistant's response text
 * @param toolResults - Any tool results that were used (stringified)
 * @returns EvaluationResult with scores and flags
 */
export async function evaluateResponse(
  userQuery: string,
  assistantResponse: string,
  toolResults?: string
): Promise<EvaluationResult | null> {
  // Skip evaluation if no API key
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = EVALUATION_PROMPT
      .replace('{user_query}', userQuery)
      .replace('{assistant_response}', assistantResponse)
      .replace('{tool_results}', toolResults || 'None');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scores: {
              type: Type.OBJECT,
              properties: {
                factual_accuracy: { type: Type.INTEGER },
                context_inclusion: { type: Type.INTEGER },
                limitation_acknowledgment: { type: Type.INTEGER },
                responsible_framing: { type: Type.INTEGER },
                query_relevance: { type: Type.INTEGER },
              },
              required: ['factual_accuracy', 'context_inclusion', 'limitation_acknowledgment', 'responsible_framing', 'query_relevance'],
            },
            flags: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING },
          },
          required: ['scores', 'flags', 'summary'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      return null;
    }

    const parsed = JSON.parse(text) as Omit<EvaluationResult, 'weighted_score'>;

    // Validate the result structure
    if (!parsed.scores) {
      return null;
    }

    // Calculate weighted score ourselves with proper penalties
    const weighted_score = calculateWeightedScore(parsed.scores);

    return {
      ...parsed,
      weighted_score
    };
  } catch (error) {
    console.error('Evaluation error:', error);
    return null;
  }
}

/**
 * Calculate weighted score from individual dimension scores.
 *
 * Critical failure penalty: If factual accuracy is 1 (fabricated data) or 2 (major errors),
 * the overall score is capped regardless of other dimensions. A response with made-up data
 * should never be rated as "Verified" (75+).
 */
export function calculateWeightedScore(scores: EvaluationResult['scores']): number {
  const weights = {
    factual_accuracy: 25,
    context_inclusion: 20,
    limitation_acknowledgment: 20,
    responsible_framing: 20,
    query_relevance: 15
  };

  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const score = scores[key as keyof typeof scores] || 1;
    total += score * weight;
  }

  // Convert from 1-5 scale (weighted) to 0-100
  // Max possible: 5 * 100 = 500, Min possible: 1 * 100 = 100
  // Normalize: (total - 100) / 4 * 100
  let weightedScore = Math.round((total - 100) / 4);

  // Critical failure penalty for factual accuracy
  // A response with fabricated or majorly incorrect data cannot be trusted,
  // regardless of how well-framed or caveated it is
  const factualAccuracy = scores.factual_accuracy || 1;
  if (factualAccuracy === 1) {
    // Fabricated data: cap at 35 (firmly in "low confidence" range)
    weightedScore = Math.min(weightedScore, 35);
  } else if (factualAccuracy === 2) {
    // Major errors: cap at 55 (below "review suggested" threshold)
    weightedScore = Math.min(weightedScore, 55);
  }

  return weightedScore;
}

/**
 * Determine if a response should be flagged for review based on evaluation.
 */
export function shouldFlagResponse(evaluation: EvaluationResult): boolean {
  // Flag if weighted score is below 60
  if (evaluation.weighted_score < 60) {
    return true;
  }

  // Flag if any individual dimension is very low
  const scores = evaluation.scores;
  if (
    scores.factual_accuracy <= 2 ||
    scores.responsible_framing <= 2
  ) {
    return true;
  }

  // Flag if there are specific concerns
  if (evaluation.flags && evaluation.flags.length > 0) {
    return true;
  }

  return false;
}

/**
 * Generate a confidence badge based on evaluation score.
 */
export function getConfidenceBadge(score: number): {
  level: 'high' | 'verified' | 'review_suggested' | 'low';
  label: string;
  color: string;
} {
  if (score >= 90) {
    return { level: 'high', label: 'High confidence', color: 'green' };
  }
  if (score >= 75) {
    return { level: 'verified', label: 'Verified', color: 'blue' };
  }
  if (score >= 60) {
    return { level: 'review_suggested', label: 'Review suggested', color: 'yellow' };
  }
  return { level: 'low', label: 'Low confidence', color: 'red' };
}
