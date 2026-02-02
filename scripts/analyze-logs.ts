#!/usr/bin/env npx tsx

/**
 * Analyze evaluation logs from logs/evaluations.jsonl
 *
 * Usage: npx tsx scripts/analyze-logs.ts
 */

import { promises as fs } from 'fs';
import path from 'path';

interface EvaluationLogEntry {
  id: string;
  timestamp: string;
  log_type: 'auto' | 'user_flagged';
  user_query: string;
  assistant_response: string;
  tool_calls: Array<{ name: string; parameters: Record<string, unknown> }>;
  evaluation: {
    scores: {
      factual_accuracy: number;
      context_inclusion: number;
      limitation_acknowledgment: number;
      responsible_framing: number;
      query_relevance: number;
    };
    weighted_score: number;
    confidence_level: string;
    flags: string[];
    summary: string;
  };
  user_feedback?: string;
}

async function main() {
  const logsPath = path.join(process.cwd(), 'logs', 'evaluations.jsonl');

  // Check if file exists
  try {
    await fs.access(logsPath);
  } catch {
    console.log('No evaluation logs found at logs/evaluations.jsonl');
    console.log('Logs will be created when responses are auto-logged (score < 75) or user-flagged.');
    process.exit(0);
  }

  // Read and parse JSONL
  const content = await fs.readFile(logsPath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    console.log('No entries in logs/evaluations.jsonl');
    process.exit(0);
  }

  const entries: EvaluationLogEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch (e) {
      console.warn('Skipping malformed line:', line.substring(0, 50));
    }
  }

  console.log('\n=== Evaluation Log Analysis ===\n');
  console.log(`Total entries: ${entries.length}`);

  // Count by type
  const autoLogs = entries.filter(e => e.log_type === 'auto');
  const userFlagged = entries.filter(e => e.log_type === 'user_flagged');
  console.log(`  Auto-logged (score < 75): ${autoLogs.length}`);
  console.log(`  User-flagged: ${userFlagged.length}`);

  // Score statistics
  const scores = entries.map(e => e.evaluation.weighted_score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  console.log(`\nScore Statistics:`);
  console.log(`  Average: ${avgScore.toFixed(1)}`);
  console.log(`  Min: ${minScore}`);
  console.log(`  Max: ${maxScore}`);

  // Dimension averages
  const dimensions = [
    'factual_accuracy',
    'context_inclusion',
    'limitation_acknowledgment',
    'responsible_framing',
    'query_relevance'
  ] as const;

  console.log(`\nDimension Averages (1-5 scale):`);
  for (const dim of dimensions) {
    const dimScores = entries.map(e => e.evaluation.scores[dim]);
    const avg = dimScores.reduce((a, b) => a + b, 0) / dimScores.length;
    const label = dim.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    console.log(`  ${label}: ${avg.toFixed(2)}`);
  }

  // Common flags
  const flagCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const flag of entry.evaluation.flags) {
      flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
    }
  }

  if (flagCounts.size > 0) {
    console.log(`\nCommon Flags:`);
    const sortedFlags = [...flagCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [flag, count] of sortedFlags.slice(0, 10)) {
      console.log(`  ${count}x: ${flag}`);
    }
  }

  // Lowest scoring responses
  console.log(`\n=== Lowest Scoring Responses ===\n`);
  const sortedByScore = [...entries].sort((a, b) => a.evaluation.weighted_score - b.evaluation.weighted_score);

  for (const entry of sortedByScore.slice(0, 5)) {
    console.log(`Score: ${entry.evaluation.weighted_score} | ${entry.log_type}`);
    console.log(`Time: ${entry.timestamp}`);
    console.log(`Query: ${entry.user_query.substring(0, 100)}${entry.user_query.length > 100 ? '...' : ''}`);
    console.log(`Summary: ${entry.evaluation.summary}`);
    if (entry.user_feedback) {
      console.log(`User Feedback: ${entry.user_feedback}`);
    }
    console.log(`Flags: ${entry.evaluation.flags.join(', ') || 'None'}`);
    console.log('---');
  }

  // User feedback summary
  const withFeedback = entries.filter(e => e.user_feedback);
  if (withFeedback.length > 0) {
    console.log(`\n=== User Feedback Summary ===\n`);
    console.log(`${withFeedback.length} responses have user feedback:\n`);

    for (const entry of withFeedback) {
      console.log(`Score: ${entry.evaluation.weighted_score}`);
      console.log(`Query: ${entry.user_query.substring(0, 80)}${entry.user_query.length > 80 ? '...' : ''}`);
      console.log(`Feedback: ${entry.user_feedback}`);
      console.log('---');
    }
  }

  // Tool usage in flagged responses
  const toolUsage = new Map<string, number>();
  for (const entry of entries) {
    for (const tool of entry.tool_calls) {
      toolUsage.set(tool.name, (toolUsage.get(tool.name) || 0) + 1);
    }
  }

  if (toolUsage.size > 0) {
    console.log(`\n=== Tool Usage in Flagged Responses ===\n`);
    const sortedTools = [...toolUsage.entries()].sort((a, b) => b[1] - a[1]);
    for (const [tool, count] of sortedTools) {
      console.log(`  ${tool}: ${count}`);
    }
  }

  // Date range
  const timestamps = entries.map(e => new Date(e.timestamp));
  const oldest = new Date(Math.min(...timestamps.map(d => d.getTime())));
  const newest = new Date(Math.max(...timestamps.map(d => d.getTime())));

  console.log(`\nDate Range:`);
  console.log(`  From: ${oldest.toISOString()}`);
  console.log(`  To: ${newest.toISOString()}`);
}

main().catch(console.error);
