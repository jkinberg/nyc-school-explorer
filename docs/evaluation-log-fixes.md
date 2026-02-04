# Evaluation Log Issue Fixes

## Problem Summary

Based on production log analysis (6 valid entries, 5 auto-logged with score < 75):

| Issue | Frequency | Impact |
|-------|-----------|--------|
| Data hallucination/fabrication | 3 incidents | Undermines trust |
| Chart generation failures | 2 incidents | Confusing UX |
| Ignoring tool results | 1 incident | Incorrect refusals |

**Key metric**: Factual Accuracy score averages 2.17/5, while other dimensions (framing, context, limitations) score 4.5-5.0.

---

## Recommended Approach: Defense in Depth

Implement both system prompt improvements AND tool-level improvements. The evaluation system is catching issues effectively - now we prevent them.

---

## Phase 1: System Prompt Improvements (High Impact, Low Effort)

**File**: `src/lib/ai/system-prompt.ts`

Added new subsection after "When using tools:" (around line 188):

```
### Strict Data Integrity Rules

1. **Never fabricate statistics**: You may ONLY cite specific numbers (counts, percentages, distributions) that appear verbatim in tool results. If you want to describe a pattern like "right-skewed" or "bimodal," you must have the actual data to support it.

2. **Chart generation failures**: When `generate_chart` returns `sample_size: 0` or an empty data array, explicitly tell the user: "The chart could not be generated because no data matched the specified criteria." Do NOT describe what the chart would have shown.

3. **Verify before claiming absence**: Before stating "I don't have access to X data," check if the field exists in the tool results. Fields like `student_attendance`, `teacher_attendance`, `pta_income` are present when available.

4. **Aggregate with caution**: When tool results are limited (e.g., `limit: 50`), do not extrapolate totals. Say "Among the 50 schools returned..." not "There are X schools total..."
```

---

## Phase 2: Chart Empty State Handler (Good UX)

**File**: `src/components/chat/ChartRenderer.tsx`

Added early return for empty data after line 60:

```tsx
// Handle empty data
if (!data || data.length === 0) {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 my-4 border border-yellow-200 dark:border-yellow-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-yellow-800 dark:text-yellow-200">
        No data matched the specified criteria. Try broadening your filters.
      </p>
    </div>
  );
}
```

---

## Phase 3: Tool-Level Error Messages (Defense in Depth)

**File**: `src/lib/mcp/tools/generate-chart.ts`

Added explicit error handling when chartData is empty (after line 288):

```typescript
if (chartData.length === 0) {
  const errorContext = {
    sample_size: 0,
    data_year: year,
    error: "NO_DATA_MATCHED",
    error_message: "No schools matched the specified filter criteria. The chart cannot be rendered. Suggest broadening filters or checking criteria.",
    citywide_medians: { ... },
    limitations: [
      "No schools matched the specified filter criteria",
      "Try broadening filters or checking criteria values"
    ]
  };

  return {
    chart: {
      type: chart_type,
      title: title || defaultTitle,
      xAxis: { label: METRIC_LABELS[x_metric] || x_metric, dataKey: x_metric },
      yAxis: { label: y_metric ? (METRIC_LABELS[y_metric] || y_metric) : 'Count', dataKey: y_metric || 'count' },
      data: [],
      colorBy: color_by,
      context: errorContext
    },
    _context: errorContext
  };
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/ai/system-prompt.ts` | Add "Strict Data Integrity Rules" section |
| `src/components/chat/ChartRenderer.tsx` | Add empty data state UI |
| `src/lib/mcp/tools/generate-chart.ts` | Add explicit error context for empty results |

---

## What We Did NOT Change

- **Not changing the evaluation system** - It's working well at detection
- **Not adding new logging** - Already have sufficient visibility
- **Not changing the chat route** - Tool context already includes data_point_count

---

## Verification

### Test 1: Hallucination Prevention
**Query**: "Show me a chart of schools in Staten Island with ENI > 0.99" (should return 0 results)

**Expected**:
- Claude says "chart could not be generated" instead of describing patterns
- UI shows yellow warning box instead of empty chart

**Result**: PASSED
- Tool returned `error: "NO_DATA_MATCHED"` with `sample_size: 0`
- Claude said "The chart could not be generated because no data matched the specified criteria"
- Claude offered an alternative with broader filters

### Test 2: Aggregate Caution
**Query**: "How many high-growth charter schools are there in the Bronx?"

**Expected**:
- Claude says "Among the X schools returned..." not absolute counts

**Result**: PASSED
- Claude said "Among Elementary/Middle Schools in the Bronx, there are 4 charter schools in the High Growth category out of 15 total high-growth schools"

---

## Monitoring

After deployment, check if factual_accuracy scores improve in future evaluation logs:

```bash
npx tsx scripts/analyze-logs.ts
```

Look for:
- Factual accuracy average moving from 2.17 toward 4.0+
- Fewer auto-logged entries (score < 75)
- No new "data hallucination" or "empty chart described" incidents

---

## Commit

```
31b1e01 Fix data hallucination and chart empty state issues
```

Deployed to production via GitHub Actions CI/CD on 2026-02-03.
