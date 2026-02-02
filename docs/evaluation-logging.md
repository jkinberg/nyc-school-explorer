# Evaluation Logging System

Log AI chat responses with poor evaluation scores (< 75) and user-flagged responses to Google Sheets via Zapier webhook, with local JSONL backup.

## Overview

- **Auto-log threshold**: weighted_score < 75 (Low Confidence + Review Suggested)
- **User feedback**: Free-form text only
- **Backup location**: `logs/evaluations.jsonl` (committed to repo)
- **Auto-log notification**: Shows "Logged for review" next to ConfidenceBadge when response was auto-logged

## Files

| File | Purpose |
|------|---------|
| `/src/lib/logging/evaluation-logger.ts` | Core logging service |
| `/src/app/api/flag/route.ts` | POST endpoint for user flagging |
| `/src/components/chat/FlagButton.tsx` | UI component for user feedback |
| `/scripts/analyze-logs.ts` | JSONL analysis script |

## Configuration

### Environment Variables

Add to `.env.local`:

```
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxx/yyy
```

If `ZAPIER_WEBHOOK_URL` is not set, logs will only be written to the local JSONL file.

## Zapier + Google Sheets Setup

### Step 1: Create Google Sheet

1. Create a new Google Sheet named "NYC School Explorer - Evaluation Logs"
2. Add the following headers in Row 1:

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | timestamp | log_type | user_query | assistant_response_preview | assistant_response_length | tool_names | tool_count | score_factual | score_context | score_limitations | score_framing | score_relevance | weighted_score | confidence_level | flags | summary | user_feedback |

3. Format timestamp column (B) as "Date time" for readability
4. Freeze Row 1 (View -> Freeze -> 1 row)

### Step 2: Create Zapier Webhook

1. Go to [zapier.com](https://zapier.com) and create a new Zap
2. **Trigger**: Search for "Webhooks by Zapier"
   - Choose "Catch Hook" as the trigger event
   - Click Continue (no setup needed)
   - Copy the webhook URL (e.g., `https://hooks.zapier.com/hooks/catch/123456/abcdef/`)
3. Click "Test trigger" - leave this tab open

### Step 3: Test the Webhook

1. Add the webhook URL to your `.env.local`:
   ```
   ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/123456/abcdef/
   ```
2. Run the dev server and trigger a low-confidence response
3. Return to Zapier and click "Test trigger" again - it should find the test data

### Step 4: Connect to Google Sheets

1. **Action**: Search for "Google Sheets"
   - Choose "Create Spreadsheet Row" as the action event
2. Connect your Google account
3. Select your spreadsheet and worksheet
4. Map the webhook fields to columns:
   - id -> Column A
   - timestamp -> Column B
   - log_type -> Column C
   - user_query -> Column D
   - assistant_response_preview -> Column E
   - assistant_response_length -> Column F
   - tool_names -> Column G
   - tool_count -> Column H
   - score_factual -> Column I
   - score_context -> Column J
   - score_limitations -> Column K
   - score_framing -> Column L
   - score_relevance -> Column M
   - weighted_score -> Column N
   - confidence_level -> Column O
   - flags -> Column P
   - summary -> Column Q
   - user_feedback -> Column R
5. Test the action to verify a row is created
6. Publish the Zap

### Step 5: Optional - Add Filtering

To only log certain types (e.g., user-flagged only), add a Filter step between trigger and action:
- Field: log_type
- Condition: (Text) Exactly matches
- Value: user_flagged

### Step 6: Set Up Filtering & Formatting

**Conditional formatting to highlight user-flagged entries:**
1. Select all data rows (A2:R1000)
2. Format -> Conditional formatting
3. Format rules -> Custom formula: `=$C2="user_flagged"`
4. Formatting style: Yellow fill
5. Click Done

**Filter by log type:**
1. Select the header row
2. Data -> Create a filter
3. Click the filter icon in Column C (log_type)
4. Uncheck values you don't want to see

**Create separate views for each type:**
1. Data -> Filter views -> Create new filter view
2. Name it "Auto-logged only"
3. Filter Column C to show only "auto"
4. Repeat for "User-flagged only" view

**Sort by score to see worst first:**
1. Data -> Sort range -> Advanced range sorting options
2. Sort by Column N (weighted_score) -> A to Z (ascending)

## Zapier Webhook Payload

The webhook receives a flattened JSON payload:

```json
{
  "id": "log-1706889600000-abc123",
  "timestamp": "2026-02-02T12:00:00.000Z",
  "log_type": "auto",
  "user_query": "Show me high growth schools",
  "assistant_response_preview": "Based on the data... (truncated)",
  "assistant_response_length": 2500,
  "tool_names": "search_schools, get_school_profile",
  "tool_count": 2,
  "score_factual": 4,
  "score_context": 3,
  "score_limitations": 4,
  "score_framing": 5,
  "score_relevance": 5,
  "weighted_score": 72,
  "confidence_level": "review_suggested",
  "flags": "Missing ENI context",
  "summary": "Accurate but incomplete context",
  "user_feedback": ""
}
```

## JSONL Backup Format

One JSON object per line at `logs/evaluations.jsonl`:

```jsonl
{"id":"log-xxx","timestamp":"...","log_type":"auto","user_query":"...","assistant_response":"...","tool_calls":[...],"evaluation":{...}}
```

The JSONL file contains the full response content (truncated to 10KB), while the Zapier payload has a 500-char preview.

## Error Handling

| Scenario | Action |
|----------|--------|
| ZAPIER_WEBHOOK_URL not set | Write to JSONL only |
| Zapier request fails | Fallback to JSONL |
| JSONL write fails | Log to console |
| Invalid flag request | Return 400 error |

All logging is non-blocking with `.catch()` handlers.

## Analysis

### Using the Script

```bash
npx tsx scripts/analyze-logs.ts
```

Output includes:
- Total entries, auto vs user-flagged counts
- Score statistics (average, min, max)
- Dimension averages (factual_accuracy, context_inclusion, etc.)
- Common flags
- Lowest-scoring responses
- User feedback summary
- Tool usage in flagged responses

### Manual Analysis

```bash
# Count entries
wc -l logs/evaluations.jsonl

# View lowest scores
cat logs/evaluations.jsonl | jq -s 'sort_by(.evaluation.weighted_score) | .[0:5]'

# Filter user-flagged only
cat logs/evaluations.jsonl | jq 'select(.log_type == "user_flagged")'

# Export to CSV
cat logs/evaluations.jsonl | jq -r '[.id, .timestamp, .log_type, .evaluation.weighted_score, .user_feedback // ""] | @csv'
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook not receiving data | Check ZAPIER_WEBHOOK_URL is set in environment |
| Wrong data in columns | Verify field mapping in Zapier action |
| Duplicate entries | Check for multiple Zaps using same webhook |
| No test data | Trigger a real evaluation with score < 75 |
| Can't tell auto vs flagged | Filter/color by Column C (log_type) |
| Logs directory missing | Create with `mkdir -p logs` |

## Claude Code Review Workflow

1. **Direct analysis**: `cat logs/evaluations.jsonl | jq '.evaluation.weighted_score'`
2. **Run script**: `npx tsx scripts/analyze-logs.ts`
3. **Export from Sheets**: Download CSV, analyze patterns
4. **Review session**: Load logs, identify common issues, plan fixes
