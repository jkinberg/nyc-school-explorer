import { promises as fs } from 'fs';
import path from 'path';
import type { EvaluationResult, EvaluationLogEntry } from '@/types/chat';

const AUTO_LOG_THRESHOLD = 75;
const ZAPIER_PREVIEW_LIMIT = 500;
const JSONL_CONTENT_LIMIT = 10 * 1024; // 10KB

// Generate unique log entry ID
function generateLogId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `log-${timestamp}-${random}`;
}

// Get confidence level from weighted score
function getConfidenceLevel(score: number): string {
  if (score >= 90) return 'high';
  if (score >= 75) return 'verified';
  if (score >= 60) return 'review_suggested';
  return 'low';
}

// Sanitize text for spreadsheet formula injection
function sanitizeForSpreadsheet(text: string): string {
  if (!text) return '';
  // Escape formula injection characters at start of cell
  const dangerous = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerous.some(char => text.startsWith(char))) {
    return "'" + text;
  }
  return text;
}

// Truncate text to limit with ellipsis
function truncate(text: string, limit: number): string {
  if (!text || text.length <= limit) return text || '';
  return text.substring(0, limit - 3) + '...';
}

// Check if evaluation score warrants auto-logging
export function shouldAutoLog(evaluation: EvaluationResult): boolean {
  return evaluation.weighted_score < AUTO_LOG_THRESHOLD;
}

interface LogEvaluationParams {
  userQuery: string;
  assistantResponse: string;
  toolCalls: Array<{ name: string; parameters: Record<string, unknown> }>;
  evaluation: EvaluationResult;
  logType: 'auto' | 'user_flagged';
  userFeedback?: string;
}

// Main logging function
export async function logEvaluation(params: LogEvaluationParams): Promise<void> {
  const {
    userQuery,
    assistantResponse,
    toolCalls,
    evaluation,
    logType,
    userFeedback
  } = params;

  const id = generateLogId();
  const timestamp = new Date().toISOString();
  const confidenceLevel = getConfidenceLevel(evaluation.weighted_score);

  // Create full log entry for JSONL backup
  const logEntry: EvaluationLogEntry = {
    id,
    timestamp,
    log_type: logType,
    user_query: truncate(userQuery, JSONL_CONTENT_LIMIT),
    assistant_response: truncate(assistantResponse, JSONL_CONTENT_LIMIT),
    tool_calls: toolCalls,
    evaluation: {
      scores: evaluation.scores,
      weighted_score: evaluation.weighted_score,
      confidence_level: confidenceLevel,
      flags: evaluation.flags,
      summary: evaluation.summary
    },
    user_feedback: userFeedback
  };

  // Create flattened payload for Zapier
  const zapierPayload = {
    id,
    timestamp,
    log_type: logType,
    user_query: sanitizeForSpreadsheet(truncate(userQuery, ZAPIER_PREVIEW_LIMIT)),
    assistant_response_preview: sanitizeForSpreadsheet(truncate(assistantResponse, ZAPIER_PREVIEW_LIMIT)),
    assistant_response_length: assistantResponse.length,
    tool_names: toolCalls.map(tc => tc.name).join(', '),
    tool_count: toolCalls.length,
    score_factual: evaluation.scores.factual_accuracy,
    score_context: evaluation.scores.context_inclusion,
    score_limitations: evaluation.scores.limitation_acknowledgment,
    score_framing: evaluation.scores.responsible_framing,
    score_relevance: evaluation.scores.query_relevance,
    weighted_score: evaluation.weighted_score,
    confidence_level: confidenceLevel,
    flags: sanitizeForSpreadsheet(evaluation.flags.join('; ')),
    summary: sanitizeForSpreadsheet(truncate(evaluation.summary, ZAPIER_PREVIEW_LIMIT)),
    user_feedback: sanitizeForSpreadsheet(userFeedback || '')
  };

  // Send to Zapier (non-blocking, with fallback)
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  let zapierSuccess = false;

  if (zapierUrl) {
    try {
      await sendToZapier(zapierUrl, zapierPayload);
      zapierSuccess = true;
    } catch (error) {
      console.error('Zapier webhook failed, falling back to JSONL:', error);
    }
  }

  // Always write to JSONL backup (or if Zapier failed)
  try {
    await writeToJSONL(logEntry);
  } catch (error) {
    console.error('JSONL write failed:', error);
  }

  // Log summary to console
  console.log(
    `[Evaluation Log] ${logType} | score=${evaluation.weighted_score} | zapier=${zapierSuccess} | id=${id}`
  );
}

// Send payload to Zapier webhook
async function sendToZapier(url: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Zapier webhook returned ${response.status}: ${response.statusText}`);
  }
}

// Write entry to JSONL file
async function writeToJSONL(entry: EvaluationLogEntry): Promise<void> {
  const logsDir = path.join(process.cwd(), 'logs');
  const filePath = path.join(logsDir, 'evaluations.jsonl');

  // Ensure logs directory exists
  await fs.mkdir(logsDir, { recursive: true });

  // Append entry as single line
  const line = JSON.stringify(entry) + '\n';
  await fs.appendFile(filePath, line, 'utf-8');
}
