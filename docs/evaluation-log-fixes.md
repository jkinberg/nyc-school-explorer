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

## Phase 4: Data Availability Documentation (Follow-up Fix)

**Problem discovered**: AI was claiming only ~65 EMS schools have attendance data when actually 96% (1,312/1,362) have it. The AI was extrapolating incorrectly from small samples with some null values.

**File**: `src/lib/ai/system-prompt.ts`

Added "Data Availability by School Type" table:

```
### Data Availability by School Type

Most metrics are available for most schools. Do NOT claim data is unavailable without checking:

| Metric | EMS | HS | D75/HST |
|--------|-----|-----|---------|
| student_attendance | 96% | 100% | No |
| teacher_attendance | 96% | 100% | No |
| Impact Score | 95%+ | 95%+ | Limited |
| Performance Score | 95%+ | 95%+ | Limited |
| ENI | 99%+ | 99%+ | 99%+ |
| Survey scores | 90%+ | 90%+ | Varies |
| PTA income | ~60% | ~40% | Limited |
| Budget (FSF) | 95%+ | 95%+ | 95%+ |

When a user asks about attendance, surveys, or other metrics, the data IS likely available. Check the tool results before claiming otherwise.
```

Also strengthened rule #3 in Strict Data Integrity Rules:

```
3. **Verify before claiming absence**: Before stating "I don't have access to X data," check if the field exists in the tool results. Most EMS and HS schools (95%+) have attendance, survey, and budget data. If you query 10 schools and see some nulls, that does NOT mean the data is broadly unavailable—it means those specific schools lack it.
```

---

## Phase 5: Search Sorting Capability (Feature Addition)

**Problem discovered**: Users couldn't query for schools sorted by specific metrics like "lowest attendance rates" - results were always sorted by impact_score descending.

**Files**: `src/lib/db/queries.ts`, `src/lib/mcp/tools/search-schools.ts`

Added sorting parameters to `search_schools` tool:

- `sort_by`: `impact_score`, `performance_score`, `economic_need_index`, `enrollment`, `student_attendance`, `teacher_attendance`, `name`
- `sort_order`: `asc` (lowest first) or `desc` (highest first, default)
- NULLs are always sorted last regardless of direction
- Uses whitelist validation to prevent SQL injection

**Example query**: "Show me the 10 EMS schools with lowest student attendance"

| School | Attendance |
|--------|------------|
| Harlem Prep Charter School | 71.3% |
| EMBER Charter School | 72.5% |
| Brooklyn Laboratory Charter School | 72.7% |
| Cultural Arts Academy Charter | 75.0% |
| P.S./I.S. 157 Benjamin Franklin | 76.0% |

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/ai/system-prompt.ts` | Add "Strict Data Integrity Rules" section + "Data Availability" table |
| `src/components/chat/ChartRenderer.tsx` | Add empty data state UI |
| `src/lib/mcp/tools/generate-chart.ts` | Add explicit error context for empty results |
| `src/lib/db/queries.ts` | Add sortBy/sortOrder params with whitelist validation |
| `src/lib/mcp/tools/search-schools.ts` | Expose sort_by and sort_order in tool definition |

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

### Test 3: Data Availability Accuracy
**Query**: "Do you have student attendance data for EMS schools?"

**Expected**:
- Claude correctly states that attendance data is available for most EMS schools (~96%)

**Result**: PASSED
- Claude said "Yes, I do have student attendance data for EMS (Elementary/Middle Schools) schools! Student attendance data is available for approximately 96% of EMS schools in the dataset."

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

## Commits

```
31b1e01 Fix data hallucination and chart empty state issues
b31743b Add data availability table to prevent false claims about missing data
4ce7fc2 Add sorting capability to search_schools tool
```

Deployed to production via GitHub Actions CI/CD on 2026-02-03.
