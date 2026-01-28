import type { EvaluationResult } from '@/types/chat';
import Anthropic from '@anthropic-ai/sdk';

/**
 * LLM-as-judge evaluation system for response quality.
 * Runs asynchronously AFTER the response is sent to the user.
 */

const EVALUATION_PROMPT = `You are evaluating the quality of an AI assistant's response about NYC school data. Score the response on five dimensions.

## Context

The assistant is designed to help users explore NYC School Quality Report data responsibly. It should provide context, acknowledge limitations, and avoid harmful patterns like rankings or deficit framing.

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
  "weighted_score": <0-100>,
  "flags": ["<specific concern 1>", "<specific concern 2>"],
  "summary": "<one sentence assessment>"
}

Calculate weighted_score as: (factual×25 + context×20 + limitations×20 + framing×20 + relevance×15) / 5`;

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
  // Skip evaluation if no API key or in development
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  try {
    const client = new Anthropic();

    const prompt = EVALUATION_PROMPT
      .replace('{user_query}', userQuery)
      .replace('{assistant_response}', assistantResponse)
      .replace('{tool_results}', toolResults || 'None');

    const response = await client.messages.create({
      model: 'claude-haiku-3-20240307',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Extract text from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return null;
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const result = JSON.parse(jsonMatch[0]) as EvaluationResult;

    // Validate the result structure
    if (!result.scores || typeof result.weighted_score !== 'number') {
      return null;
    }

    return result;
  } catch (error) {
    console.error('Evaluation error:', error);
    return null;
  }
}

/**
 * Calculate weighted score from individual dimension scores.
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
  return Math.round((total - 100) / 4);
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
