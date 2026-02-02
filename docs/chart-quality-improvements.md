# Chart Quality Improvement Options

Charts are an important feature but visual issues are hard to track systematically. This document outlines options for improving chart quality assurance.

## Current Challenges

- Visual rendering issues are one-off and hard to reproduce
- No systematic way to track chart problems
- Issues span multiple areas: colors, labels, data mapping, chart type selection
- Hard to regression test visual output

---

## Option 1: Chart-Specific Flagging (Recommended First Step)

Add a small flag button on each rendered chart that logs the chart configuration when users encounter issues.

**What gets logged:**
- Chart type (scatter, bar, histogram)
- Axis configuration (labels, data keys)
- colorBy setting and values
- Sample of data points (first 5-10)
- User's description of the issue
- Timestamp and session info

**Implementation:**
1. Create new Zapier webhook + Google Sheet for chart issues
2. Add `ZAPIER_CHART_WEBHOOK_URL` env variable
3. Create `/api/flag-chart` endpoint
4. Add `ChartFlagButton` component to `ChartRenderer.tsx`
5. Log to sheet with chart config JSON

**Pros:**
- Builds on existing logging infrastructure
- Captures real user-encountered issues
- Low effort to implement
- Creates corpus of examples for pattern analysis

**Cons:**
- Requires new Zapier zap and Google Sheet
- Reactive (only catches issues users report)
- Doesn't prevent regressions

**Effort:** ~2-3 hours

---

## Option 2: Chart Test Gallery

Create a dedicated page that renders a comprehensive suite of chart configurations for manual QA review.

**Test cases to include:**
```
Scatter plots:
- colorBy: category (5 categories)
- colorBy: borough (5 boroughs)
- colorBy: is_charter (2 values)
- No colorBy (single color)
- Small dataset (< 10 points)
- Large dataset (500+ points)
- Extreme axis values

Bar charts:
- Standard histogram bins
- Few bins (3-5)
- Many bins (20+)
- Long labels

Edge cases:
- Missing data points
- Single data point
- All same value
- Negative values
```

**Implementation:**
1. Create `/app/chart-tests/page.tsx`
2. Define test fixtures with known data
3. Render grid of charts with labels
4. Add to CI as manual review step (or screenshot comparison)

**Pros:**
- Catches regressions before deploy
- Documents expected behavior
- Quick visual scan for issues

**Cons:**
- Manual review required
- Doesn't catch issues with real data patterns
- Test fixtures may not cover all edge cases

**Effort:** ~3-4 hours

---

## Option 3: LLM-as-Judge for Chart Appropriateness

Extend the existing evaluation system to assess chart quality.

**Evaluation criteria:**
- Is the chart type appropriate for the question?
- Are axes labeled correctly?
- Is the colorBy choice meaningful?
- Does the chart answer the user's question?

**Limitations:**
- Cannot evaluate visual rendering (colors, overlaps, readability)
- Adds latency and cost to evaluation
- May not correlate with actual visual issues

**Pros:**
- Automated
- Catches semantic issues (wrong chart type)

**Cons:**
- Blind to rendering bugs
- Additional API cost

**Effort:** ~2 hours to extend evaluation prompt

---

## Option 4: Visual Regression Testing

Use Playwright or similar to capture chart screenshots and compare against baselines.

**Implementation:**
1. Add Playwright to dev dependencies
2. Create test suite that navigates to chart-tests page
3. Capture screenshots of each chart
4. Compare against baseline images
5. Fail CI if diff exceeds threshold

**Pros:**
- Automated regression detection
- Catches actual visual issues
- Runs in CI

**Cons:**
- Significant setup effort
- Baseline maintenance overhead
- Flaky tests possible (font rendering, timing)
- Doesn't help discover new issue types

**Effort:** ~6-8 hours initial setup, ongoing maintenance

---

## Option 5: Structured Chart Issue Tracking

Create a GitHub issue template specifically for chart issues with structured fields.

**Template fields:**
- Chart type
- Query that generated the chart
- Screenshot (required)
- Expected behavior
- Actual behavior
- Browser/device

**Pros:**
- Uses existing GitHub infrastructure
- Structured data for analysis
- Public record of issues

**Cons:**
- Requires manual issue creation
- Not integrated with app

**Effort:** ~30 minutes

---

## Recommended Approach

### Phase 1: Quick Wins (This Week)
1. **Chart flagging** (#1) - Capture real issues as they occur
2. **GitHub issue template** (#5) - Structured tracking for reported issues

### Phase 2: Prevention (Next Sprint)
3. **Chart test gallery** (#2) - Manual QA before deploys
4. **Extend evaluation** (#3) - Catch semantic issues

### Phase 3: Automation (Future)
5. **Visual regression** (#4) - Automated screenshot comparison

---

## Common Chart Issues to Track

Based on observed issues, watch for:

| Issue | Root Cause | Fix Location |
|-------|------------|--------------|
| Indistinguishable colors | Missing color mapping | `ChartRenderer.tsx` |
| Legend shows raw values | Missing label mapping | `ChartRenderer.tsx` |
| Wrong chart type | LLM choice | System prompt |
| Axes not labeled | Missing config | `generate_chart` tool |
| Data points overlap | No jitter/transparency | `ChartRenderer.tsx` |
| Too many legend items | Unbounded categories | `generate_chart` tool |
| Chart too small | Container sizing | CSS |
| Tooltip missing info | Incomplete tooltip | `ChartRenderer.tsx` |

---

## Next Steps

1. Decide on Phase 1 approach
2. Create Zapier webhook for chart flagging (if proceeding with #1)
3. Implement chosen solution
4. Review collected issues after 1-2 weeks to identify patterns
