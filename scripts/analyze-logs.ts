#!/usr/bin/env npx tsx

/**
 * Analyze evaluation logs from JSONL or CSV
 *
 * Usage:
 *   npx tsx scripts/analyze-logs.ts                    # Read from logs/evaluations.jsonl
 *   npx tsx scripts/analyze-logs.ts --csv export.csv   # Read from Google Sheets CSV export
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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }

  return rows;
}

function csvRowToEntry(row: Record<string, string>): EvaluationLogEntry {
  // Convert flat CSV row back to nested structure
  const toolNames = row.tool_names ? row.tool_names.split(', ').filter(Boolean) : [];

  return {
    id: row.id,
    timestamp: row.timestamp,
    log_type: row.log_type as 'auto' | 'user_flagged',
    user_query: row.user_query,
    assistant_response: row.assistant_response_preview || '',
    tool_calls: toolNames.map(name => ({ name, parameters: {} })),
    evaluation: {
      scores: {
        factual_accuracy: parseInt(row.score_factual) || 0,
        context_inclusion: parseInt(row.score_context) || 0,
        limitation_acknowledgment: parseInt(row.score_limitations) || 0,
        responsible_framing: parseInt(row.score_framing) || 0,
        query_relevance: parseInt(row.score_relevance) || 0,
      },
      weighted_score: parseInt(row.weighted_score) || 0,
      confidence_level: row.confidence_level || '',
      flags: row.flags ? row.flags.split(', ').filter(Boolean) : [],
      summary: row.summary || '',
    },
    user_feedback: row.user_feedback || undefined,
  };
}

async function loadFromJSONL(filePath: string): Promise<EvaluationLogEntry[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());

  const entries: EvaluationLogEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      console.warn('Skipping malformed line:', line.substring(0, 50));
    }
  }
  return entries;
}

async function loadFromCSV(filePath: string): Promise<EvaluationLogEntry[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const rows = parseCSV(content);
  return rows.map(csvRowToEntry);
}

async function main() {
  const args = process.argv.slice(2);
  let entries: EvaluationLogEntry[] = [];
  let sourceLabel = '';

  // Check for --csv flag
  const csvIndex = args.indexOf('--csv');
  if (csvIndex !== -1 && args[csvIndex + 1]) {
    const csvPath = args[csvIndex + 1];
    try {
      await fs.access(csvPath);
      entries = await loadFromCSV(csvPath);
      sourceLabel = `CSV: ${csvPath}`;
    } catch {
      console.error(`Cannot read CSV file: ${csvPath}`);
      process.exit(1);
    }
  } else {
    // Default: read from JSONL
    const logsPath = path.join(process.cwd(), 'logs', 'evaluations.jsonl');
    try {
      await fs.access(logsPath);
      entries = await loadFromJSONL(logsPath);
      sourceLabel = 'JSONL: logs/evaluations.jsonl';
    } catch {
      console.log('No evaluation logs found at logs/evaluations.jsonl');
      console.log('');
      console.log('Usage:');
      console.log('  npx tsx scripts/analyze-logs.ts                    # Read local JSONL');
      console.log('  npx tsx scripts/analyze-logs.ts --csv export.csv   # Read Google Sheets CSV');
      process.exit(0);
    }
  }

  if (entries.length === 0) {
    console.log('No entries found in log file');
    process.exit(0);
  }

  console.log('\n=== Evaluation Log Analysis ===');
  console.log(`Source: ${sourceLabel}\n`);
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
