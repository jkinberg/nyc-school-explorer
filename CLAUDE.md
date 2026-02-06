# NYC School Explorer

An AI-native data journalism tool for exploring NYC School Quality Report data through natural language conversation, with responsible AI guardrails and transparent methodology.

## Quick Start

```bash
# Install dependencies
npm install

# Seed the database (if not already done)
npx tsx scripts/seed-database.ts

# Add your API key to .env.local
echo "ANTHROPIC_API_KEY=your-key-here" > .env.local

# Run development server
npm run dev
```

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Database**: SQLite with better-sqlite3
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514 for chat), Google Gemini (gemini-3-flash-preview for evaluation)
- **Charts**: Recharts
- **Markdown**: react-markdown with remark-gfm
- **Styling**: Tailwind CSS 4

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Home page
│   ├── explore/page.tsx          # AI Chat interface (primary feature)
│   ├── high-growth/page.tsx      # High Growth Schools list
│   ├── search/page.tsx           # Filter/search schools
│   ├── about/page.tsx            # Methodology documentation
│   ├── school/[dbn]/page.tsx     # Individual school profile
│   └── api/
│       ├── chat/route.ts         # Main chat endpoint with Claude
│       ├── flag/route.ts         # User feedback flagging endpoint
│       └── schools/              # REST API for school data
├── components/
│   ├── chat/                     # Chat interface components
│   │   ├── ChatInterface.tsx     # Main chat container with scroll behavior
│   │   ├── MessageBubble.tsx     # Individual message display
│   │   ├── MarkdownRenderer.tsx  # React-markdown with school name linking
│   │   ├── ToolCallDisplay.tsx   # Collapsible MCP tool execution cards
│   │   ├── ScrollToBottomButton.tsx  # Floating scroll button
│   │   ├── ChartRenderer.tsx     # Recharts visualization with PNG/CSV export
│   │   ├── ConfidenceBadge.tsx   # LLM-as-judge score display + copy button
│   │   ├── CopyButton.tsx        # Reusable copy-to-clipboard button
│   │   ├── FlagButton.tsx        # User feedback modal for flagging responses
│   │   └── SuggestedQueries.tsx  # Follow-up query suggestions
│   ├── schools/                  # School display components
│   └── common/                   # Shared components
├── hooks/
│   └── useScrollBehavior.ts      # Smart scroll management for streaming
├── lib/
│   ├── ai/                       # AI guardrails
│   │   ├── prefilter.ts          # Pre-filter harmful queries
│   │   ├── system-prompt.ts      # Claude system prompt
│   │   ├── evaluation.ts         # LLM-as-judge scoring
│   │   └── suggestions.ts        # Contextual follow-up suggestions
│   ├── db/                       # Database layer
│   │   ├── connection.ts         # SQLite connection
│   │   └── queries.ts            # Query functions
│   ├── logging/                  # Evaluation logging
│   │   └── evaluation-logger.ts  # Log low-scoring/flagged responses to Zapier + JSONL
│   ├── mcp/                      # MCP tools
│   │   ├── index.ts              # Tool definitions & executor
│   │   └── tools/                # Individual tool implementations
│   └── utils/                    # Helpers (formatting, rate-limit, fuzzy search)
├── types/                        # TypeScript types
│   ├── school.ts                 # School-related types
│   └── chat.ts                   # Chat-related types
scripts/
│   ├── seed-database.ts          # Database seeding script
│   └── analyze-logs.ts           # Analyze evaluation logs from JSONL
logs/
│   └── evaluations.jsonl         # Local backup of logged evaluations
```

## Key Concepts

### School Categories

Categories are computed for **all school types** using the same thresholds (Impact ≥ 0.55, Performance ≥ 0.50, ENI ≥ 0.85). However, these thresholds were validated using Elementary/Middle School (EMS) data, where they represent approximately the 75th percentile. The same thresholds may represent different percentiles for High Schools and other school types.

Schools are categorized based on three thresholds (computed during data import):

| Category | Impact Score | Performance Score | ENI |
|----------|-------------|-------------------|-----|
| **Strong Growth + Strong Outcomes** | >= 0.55 | >= 0.50 | >= 0.85 |
| **Strong Growth, Building Outcomes** | >= 0.55 | < 0.50 | >= 0.85 |
| **Strong Outcomes, Moderate Growth** | < 0.55 | >= 0.50 | >= 0.85 |
| **Developing on Both Metrics** | < 0.55 | < 0.50 | >= 0.85 |
| **Lower Economic Need** | any | any | < 0.85 |

- **Impact Score**: Measures student growth relative to similar students (less correlated with poverty)
- **Performance Score**: Measures absolute outcomes (strongly correlated with poverty, r = -0.69)
- **ENI (Economic Need Index)**: Poverty indicator (0-1 scale)

### Persistent High Growth

Elementary/Middle Schools that maintained high-impact status (Strong Growth + Strong Outcomes or Strong Growth, Building Outcomes) in BOTH 2023-24 and 2024-25 school years. Query `getPersistentGems('EMS')` for current count.

### Scope Considerations

While categories are computed for all school types, the High Growth Schools page and `get_curated_lists` tool default to EMS because:
- The thresholds were validated using EMS data (75th percentile cutoffs)
- High Schools have different score distributions
- EMS represents the largest sample size for robust patterns

When querying categories:
- Use `report_type='EMS'` for the validated framework
- Other school types can be queried but interpret with caution
- Always note the school type when presenting category-based findings

### Three-Layer AI Guardrails

1. **Pre-filter** (`src/lib/ai/prefilter.ts`): Fast regex patterns that block obviously harmful queries before calling Claude
   - Blocks: "rank best/worst schools", "schools to avoid", demographic percentage filtering
   - Returns immediate reframe response

2. **System Prompt** (`src/lib/ai/system-prompt.ts`): Comprehensive instructions for responsible responses
   - Requires context (ENI + both scores) with every finding
   - Emphasizes Impact Score over Performance Score
   - Requires uncertainty language ("suggests" not "proves")
   - Provides competing hypotheses for patterns

3. **Tool-Level** (`src/lib/mcp/tools/`): Every tool response includes `_context` with:
   - Citywide medians for comparison
   - Sample size and data year
   - Methodology warnings and limitations

### MCP Tools

| Tool | Purpose |
|------|---------|
| `search_schools` | Filter schools by borough, category, metrics. Supports `query` param for name/DBN search, `sort_by` and `sort_order` for custom sorting |
| `get_school_profile` | Detailed school view with YoY comparison. Returns suggestions if DBN not found |
| `find_similar_schools` | Find peer schools by ENI (±5%) and enrollment (±20%) |
| `compare_schools` | Compare 2-10 schools across metrics. Supports specific DBNs, vs citywide, vs similar peers, or filtered groups |
| `analyze_correlations` | Calculate correlation between metrics. Supports 19 metrics including surveys and staff data |
| `generate_chart` | Return data for Recharts visualizations (scatter, bar, histogram, yoy_change, diverging_bar) |
| `explain_metrics` | Educational content about methodology |
| `get_curated_lists` | Pre-computed High Growth, Strong Growth + Outcomes, Persistent High Growth lists |

### Correlation Metrics

The `analyze_correlations` tool supports these metrics:

| Category | Metrics |
|----------|---------|
| Core | `impact_score`, `performance_score`, `economic_need_index`, `enrollment` |
| Attendance | `student_attendance`, `teacher_attendance` |
| Staff | `principal_years`, `pct_teachers_3plus_years` |
| Budget | `total_budget`, `pct_funded`, `pta_income` |
| Suspensions | `total_suspensions` |
| Surveys | `survey_family_involvement`, `survey_family_trust`, `survey_safety`, `survey_communication`, `survey_instruction`, `survey_leadership`, `survey_support` |

### Natural Language Metric Mapping

The system prompt includes guidance for mapping natural language to metric names:

| User says | Maps to |
|-----------|---------|
| "family engagement", "parent involvement" | `survey_family_involvement` |
| "principal tenure", "principal experience" | `principal_years` |
| "teacher experience", "experienced teachers" | `pct_teachers_3plus_years` |
| "student growth", "learning gains" | `impact_score` |
| "test scores", "achievement" | `performance_score` |
| "poverty", "economic need" | `economic_need_index` |

### Tool Selection Guidelines

The system prompt guides Claude on when to use each tool:

- **Correlation questions** → `analyze_correlations` (returns r-value)
- **Visualization requests** → `generate_chart` (returns chart data)
- **School lookups** → `search_schools` or `get_school_profile`

This prevents Claude from using `generate_chart` to answer correlation questions (which wouldn't provide the actual r-value).

### Chart Types

The `generate_chart` tool supports multiple chart types:

| Chart Type | Purpose | Key Parameters |
|------------|---------|----------------|
| `scatter` | Explore relationships between two metrics | `x_metric`, `y_metric`, `color_by` |
| `bar` | Compare categories or values | `x_metric` |
| `histogram` | Show distribution of a single metric | `x_metric` |
| `yoy_change` | Year-over-year comparison (scatter format) | `x_metric` |
| `diverging_bar` | Show values above/below a threshold | `x_metric`, `midpoint`, `show_change` |

### Diverging Bar Charts

The `diverging_bar` chart type visualizes values relative to a threshold (midpoint):

**Use cases:**
- "Which schools are above or below expected growth?" (Impact Score vs 0.50)
- "Which schools improved or declined from last year?" (YoY change vs 0)
- "How do schools compare to the citywide average?"

**Parameters:**
- `midpoint`: Threshold value. Defaults: 0.50 for Impact, 0.49 for Performance, 0.90 for attendance
- `show_change`: If true, calculates year-over-year change (midpoint defaults to 0)
- `filter`: Supports all standard filters (borough, min_eni, report_type, is_charter, category)
- `limit`: Max schools to display (default: 30)

**Query pattern mapping:**
| User says | Parameters |
|-----------|------------|
| "above or below expected" | `chart_type: "diverging_bar"` |
| "exceed or fall short" | `chart_type: "diverging_bar"` |
| "improved or declined" | `chart_type: "diverging_bar", show_change: true` |
| "gained or lost ground" | `chart_type: "diverging_bar", show_change: true` |

### Fuzzy School Search

The system supports flexible school name searching with several features:

**Name Search via `search_schools`:**
- Use `query` parameter to search by school name or DBN
- Single word matches both name and DBN columns
- Multiple words use AND logic (all must appear in name)
- Example: `search_schools({ query: "Brooklyn Tech" })`

**Abbreviation Normalization:**
- Common abbreviations are automatically expanded: PS → P.S., IS → I.S., MS → M.S., JHS → J.H.S.
- "PS 188" will match "P.S. 188 The Island School"

**Fallback Suggestions in `get_school_profile`:**
- If exact DBN not found, returns `suggestions` array with up to 5 similar schools
- Suggestions use LIKE matching first, then Levenshtein fuzzy matching
- Example: `get_school_profile({ dbn: "Brooklyn Tech" })` returns suggestions

### Natural Language Sorting

The AI understands natural language sorting requests and maps them to `sort_by`/`sort_order` parameters:

| User Says | Maps To |
|-----------|---------|
| "worst attendance" / "lowest attendance" | `sort_by="student_attendance", sort_order="asc"` |
| "best attendance" / "highest attendance" | `sort_by="student_attendance", sort_order="desc"` |
| "highest impact" / "most growth" | `sort_by="impact_score", sort_order="desc"` |
| "lowest impact" / "least growth" | `sort_by="impact_score", sort_order="asc"` |
| "largest schools" | `sort_by="enrollment", sort_order="desc"` |
| "smallest schools" | `sort_by="enrollment", sort_order="asc"` |
| "highest poverty" / "most need" | `sort_by="economic_need_index", sort_order="desc"` |

Example: "What are the largest high schools in Manhattan?" generates:
```json
{ "borough": "Manhattan", "report_type": "HS", "sort_by": "enrollment", "sort_order": "desc" }
```

**Typo Tolerance (Levenshtein):**
- When LIKE search returns no results, fuzzy matching kicks in
- Edit distance ≤ 3 for typos like "Stuyvesent" → "Stuyvesant"
- Implemented in `src/lib/utils/fuzzy.ts`

## Database Schema

**Tables:**
- `schools` - Core school info (dbn, name, borough, school_type)
- `school_metrics` - Yearly metrics (one row per school per year)
- `persistent_gems` - Schools with high impact both years
- `citywide_stats` - Pre-computed citywide statistics
- `pta_data` - PTA financial data (beginning_balance, income, expenses, ending_balance) by year
- `school_locations` - Address, coordinates, grades, principal, NTA, council district, building code
- `school_budgets` - LL16 budget data (total budget, FSF allocation, % funded) by year
- `school_suspensions` - LL93 suspension data (removals, principal/superintendent suspensions) by year

**Key indexes:** category, economic_need_index, impact_score, borough, building_code, nta, budget year, suspension year

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Main chat endpoint, accepts `{ messages: Message[] }` |
| `/api/flag` | POST | User feedback flagging, accepts `{ message_id, user_query, assistant_response, feedback }` |
| `/api/schools` | GET | Search schools with query params |
| `/api/schools/[dbn]` | GET | Get individual school profile |
| `/api/schools/gems` | GET | Get curated lists (type=high_growth\|persistent_high_growth\|high_growth_high_achievement) |
| `/api/mcp` | POST | MCP endpoint for external AI agents (JSON-RPC 2.0) |

## MCP API

The `/api/mcp` endpoint allows external AI agents (Claude Desktop, other MCP clients) to query school data programmatically.

**Key features:**
- JSON-RPC 2.0 protocol
- Methods: `initialize`, `tools/list`, `tools/call`
- Rate limited: 60 requests/minute per IP
- No authentication required (database queries only, no LLM calls)

**Available tools via MCP:** All tools from `src/lib/mcp/index.ts` are exposed:
- `search_schools`, `get_school_profile`, `find_similar_schools`
- `analyze_correlations`, `generate_chart`, `explain_metrics`, `get_curated_lists`

See [docs/mcp-api.md](docs/mcp-api.md) for full documentation.

## Evaluation Logging

The system logs AI responses with poor evaluation scores (< 75) and user-flagged responses for review.

- **Auto-logging**: Responses with `weighted_score < 75` are automatically logged
- **User flagging**: Users can click "Flag" on any response to submit feedback
- **Storage**: Logs go to Zapier webhook (for Google Sheets) and local `logs/evaluations.jsonl` backup
- **Analysis**: Run `npx tsx scripts/analyze-logs.ts` to analyze logged responses

See [docs/evaluation-logging.md](docs/evaluation-logging.md) for Zapier/Google Sheets setup instructions.

## Important Patterns

### Response Context

Every API response and tool result includes a `_context` object:

```typescript
_context: {
  data_year: string;
  citywide_medians: { impact: number; performance: number; eni: number };
  sample_size: number;
  limitations?: string[];
}
```

### Chat API Flow

1. Receive messages from client
2. Run pre-filter on latest user message
3. If blocked, return reframe immediately (with `evaluating: false`)
4. Call Claude with system prompt and tool definitions
5. Execute any tool calls Claude requests
6. **Summarize tool results** before sending back to Claude (see below)
7. Stream response via SSE (`text_delta` events)
8. Emit `done` event with `evaluating: true/false` flag
9. Generate contextual follow-up suggestions (15s timeout), emit `suggested_queries` SSE event
10. If evaluation enabled: await LLM-as-judge evaluation (30s timeout), emit `evaluation` SSE event
11. Close stream

### Tool Result Summarization (ESSENTIAL_SCHOOL_FIELDS)

To reduce token usage, tool results are summarized before being sent back to Claude. The `ESSENTIAL_SCHOOL_FIELDS` constant in `src/app/api/chat/route.ts` defines which school fields are preserved:

```typescript
const ESSENTIAL_SCHOOL_FIELDS = [
  'dbn', 'name', 'borough', 'impact_score', 'performance_score',
  'economic_need_index', 'enrollment', 'category', 'is_charter',
  'student_attendance', 'teacher_attendance',
  // Survey scores (family engagement, safety, etc.)
  'survey_family_involvement', 'survey_family_trust', 'survey_safety',
  'survey_communication', 'survey_instruction', 'survey_leadership', 'survey_support',
  // Ratings (string values like "Meeting Target")
  'rating_instruction', 'rating_safety', 'rating_families',
  // Staff metrics
  'principal_years', 'pct_teachers_3plus_years'
] as const;
```

**IMPORTANT**: If you add a new field to school data that Claude needs to see, you must add it to this list. Otherwise, Claude will not receive the field in tool results and may incorrectly claim the data is unavailable.

The `analyze_correlations` tool also has an enum of supported metrics. If you add a new **numeric** metric field, update:
1. `ESSENTIAL_SCHOOL_FIELDS` in `src/app/api/chat/route.ts`
2. The `MetricName` type in `src/lib/mcp/tools/analyze-correlations.ts`
3. The `METRIC_LABELS` mapping in the same file
4. The enum in `analyzeCorrelationsDefinition.parameters`
5. The natural language mapping in `src/lib/ai/system-prompt.ts`

Note: Rating fields (rating_instruction, rating_safety, rating_families) are strings like "Meeting Target" and cannot be used in correlations.

The full unsummarized tool results are still:
1. Sent to the client via SSE events (for UI display)
2. Stored for LLM-as-judge evaluation
3. Used for school name extraction and linking
4. Used for contextual follow-up suggestion generation

Only the conversation context sent back to Claude is summarized.

### Chat Interface Features

The chat UI (`src/components/chat/`) includes several user experience enhancements:

**Markdown Rendering** (`MarkdownRenderer.tsx`):
- Uses `react-markdown` with `remark-gfm` for full GitHub-flavored markdown support
- Styled tables with proper borders, header backgrounds, and horizontal scrolling
- Lists with proper indentation (bullets and numbers)
- Code blocks and inline code with gray backgrounds
- All links open in new tabs to preserve chat context

**School Name Linking**:
- DBNs (e.g., `09X004`) are automatically detected and linked to `/school/[dbn]`
- School names from tool results are extracted and auto-linked in responses
- Mappings are sent via `tool_end` SSE events with `schools` array

**MCP Tool Visibility** (`ToolCallDisplay.tsx`):
- Shows collapsible cards when Claude calls tools
- Displays tool name with human-readable labels (e.g., "Search Schools")
- Status indicator: spinning loader (running) or checkmark (completed)
- Expandable section shows parameters and result summary

**Smart Scroll Behavior** (`useScrollBehavior.ts`, `ScrollToBottomButton.tsx`):
- No auto-scroll during streaming (user can read at their pace)
- If user scrolls up, position is maintained
- Floating "New messages" button appears when not at bottom
- Button positioned above input area for easy access

**Copy and Export** (`CopyButton.tsx`, `ChartRenderer.tsx`, `ConfidenceBadge.tsx`):
- **Copy response text**: Copy button on assistant messages copies plain text to clipboard
- **Export chart as PNG**: Downloads chart as high-resolution PNG image (2x for retina) with all styling preserved via inline CSS
- **Export chart as CSV**: Downloads chart data with proper escaping for commas and quotes
- **Copy evaluation**: Copy button in evaluation dropdown formats scores, summary, and flags as text
- Visual feedback: Button shows "Copied" with checkmark for 2 seconds after copying

### Contextual Follow-up Suggestions

After each response, the system generates contextual follow-up query suggestions using Gemini Flash (`src/lib/ai/suggestions.ts`):

**Entity Extraction**: Tool results are parsed to extract key entities:
- Schools mentioned (name, DBN, borough)
- Boroughs discussed
- Metrics analyzed (impact_score, performance_score, etc.)
- Analysis type (comparison, correlation, chart, profile)

**LLM Generation**: Gemini receives:
- User query
- Assistant response (up to 4000 chars)
- Extracted entities summary

**Example Output**:
- After comparing Bronx schools: "Compare Bronx International HS to other international schools"
- After school profile: "Compare P.S. 188 to other high-growth Manhattan schools"
- After correlation: "Does teacher attendance correlate at high-poverty schools?"

**Fallback**: If LLM fails or times out (15s), entity-based contextual fallback generates suggestions using extracted schools, boroughs, and analysis types.

**Guardrails**: All suggestions are validated against the same prefilter patterns used for user queries. Suggestions that would be blocked (rankings, demographic filtering) are filtered out.

### Evaluation SSE Flow

The chat API keeps the SSE stream open after `done` to deliver evaluation results:

```
text_delta → ... → done (evaluating: true) → [2-5s] → suggested_queries → evaluation → stream closes
```

- The `done` event includes an `evaluating` boolean so the client can show an "Evaluating response..." indicator
- Evaluation uses `gemini-3-flash-preview` (independent model provider from the main chat model)
- On timeout or failure, the stream closes without an `evaluation` event; the client cleans up gracefully
- Pre-filtered (blocked) responses skip evaluation entirely (`evaluating: false`)
- The `ConfidenceBadge` component renders evaluation scores below assistant message bubbles as a click-to-expand panel

### Responsible Framing

When modifying or adding features, maintain these principles:
- Never present metrics in isolation (always include ENI context)
- Prefer Impact Score when discussing "quality" or "effectiveness"
- Use uncertainty language for all findings
- Present multiple hypotheses for patterns (not just "good teaching")
- Refuse to rank schools "best to worst"
- Refuse demographic filtering queries

## Data Sources

NYC DOE School Quality Reports (2022-23, 2023-24, and 2024-25):
- Elementary/Middle/K-8 (EMS reports)
- High School (HS reports)
- High School Transfer (HST reports)
- District 75 (D75 reports)
- Early Childhood (EC reports)

**Note:** Impact Score and Performance Score were introduced in 2023-24. The 2022-23 data includes ratings, surveys, ENI, enrollment, and demographics, but NOT Impact/Performance scores (those columns are NULL).

**Rating Column Mapping:** NYC DOE renamed rating columns between 2022-23 and 2023-24. We merge them for trend analysis:
| Database Column | 2022-23 Source | 2023-24+ Source |
|-----------------|----------------|-----------------|
| `rating_instruction` | Rigorous Instruction Rating | Instruction and Performance - Rating |
| `rating_safety` | Supportive Environment Rating | Safety and School Climate - Rating |
| `rating_families` | Strong Family-Community Ties Rating | Relationships with Families - Rating |

Year-over-year rating comparisons should acknowledge potential methodology changes.

Additional data sources:
- **LCGMS** (Location Code Management System) + ShapePoints DBF for school locations and coordinates
- **LL16 Budget Reports** (2022-23, 2023-24, 2024-25) - Fair Student Funding allocations
- **LL93 Suspension Reports** (2022-23, 2023-24, 2024-25) - Student discipline data
- **PTA Financial Reporting** (2022-23, 2023-24, 2024-25) - PTA income, expenses, and balance

Raw Excel files are in `/Users/josh/Projects/nyc-schools-data/data-samples/raw/`

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...    # Required for chat functionality
GEMINI_API_KEY=...              # Required for LLM-as-judge evaluation (Gemini Flash)
ENABLE_EVALUATION=true          # Set to "false" to disable LLM-as-judge evaluation (default: enabled)
ZAPIER_WEBHOOK_URL=...          # Optional: Zapier webhook for evaluation logging to Google Sheets
```

## Testing

The project uses Vitest with React Testing Library. Tests focus on business logic over UI, with fast feedback (<2 seconds).

### Running Tests

```bash
# Run tests in watch mode
npm run test

# Run tests once (CI mode)
npm run test:run

# Run with coverage report
npm run test:coverage
```

### Test Organization

```
src/
├── lib/
│   ├── ai/__tests__/
│   │   ├── prefilter.test.ts       # AI guardrails (50 tests)
│   │   └── evaluation.test.ts      # Scoring functions (27 tests)
│   ├── db/__tests__/
│   │   ├── queries.test.ts         # Query logic (35 tests)
│   │   └── fixtures.ts             # Test data fixtures
│   ├── mcp/tools/__tests__/
│   │   ├── search-schools.test.ts  # Search tool (34 tests)
│   │   └── get-school-profile.test.ts # Profile tool (22 tests)
│   └── utils/__tests__/
│       ├── formatting.test.ts      # Formatting utilities (47 tests)
│       └── fuzzy.test.ts           # Fuzzy matching (26 tests)
└── components/chat/__tests__/
    ├── ChartRenderer.test.tsx      # Chart export (20 tests)
    ├── ConfidenceBadge.test.tsx    # Evaluation display (9 tests)
    └── CopyButton.test.tsx         # Copy functionality (5 tests)
```

### Test Coverage by Module

| Module | Tests | Focus |
|--------|-------|-------|
| AI Prefilter | 50 | Block patterns, flag patterns, false positive prevention |
| AI Evaluation | 27 | Weighted scoring, confidence badges, flagging logic |
| MCP Tools | 109 | Filtering, sorting, comparison, context generation, category mapping |
| Database Queries | 35 | Abbreviation normalization, correlation math, category logic |
| Utilities | 73 | Formatting edge cases, Levenshtein distance, fuzzy matching |
| UI Components | 34 | Chart export, copy functionality, evaluation display |
| **Total** | **328** | **~1.5 seconds runtime** |

### Testing Philosophy

1. **Test business logic over UI**: MCP tools and AI guardrails contain core value
2. **Fast feedback loop**: All tests run in <2 seconds
3. **Test at the right level**: Unit tests for logic, mock external services
4. **Incremental coverage**: Add tests with each feature

### What's NOT Tested

- Database integration (would require in-memory SQLite)
- API routes (would require mocking Claude/Gemini APIs)
- Simple pass-through components
- Third-party library behavior (Recharts, react-markdown)

### Adding Tests for New Features

| Change Type | Test Level | Location |
|-------------|------------|----------|
| New MCP tool | Unit test tool logic | `src/lib/mcp/tools/__tests__/` |
| New utility function | Unit test with edge cases | `src/lib/utils/__tests__/` |
| New prefilter pattern | Add pattern test | `src/lib/ai/__tests__/prefilter.test.ts` |
| UI component with logic | React Testing Library | `src/components/[module]/__tests__/` |
| Bug fix | Add regression test | Adjacent to source file |

### Test Setup Files

- `vitest.config.ts`: Vitest configuration with React plugin and path aliases
- `vitest.setup.ts`: Global mocks for clipboard, Blob, XMLSerializer, Image, canvas

### Evaluation Rubric Testing

The `scripts/test-evaluation-rubric.ts` script tests the LLM-as-judge evaluation system against production:

```bash
npx tsx scripts/test-evaluation-rubric.ts https://your-production-url.run.app
```

This script:
1. Sends 12 test queries covering core functionality and regression tests
2. Parses SSE responses and evaluation scores
3. Reports factual accuracy scores and flags
4. Identifies potential false positives in the evaluation rubric

**Test queries include:**
- Core data facts (correlations, counts, thresholds)
- School profiles and searches
- Attendance sorting (regression test for data availability)
- Survey metrics correlation (regression test for family engagement)
- Staff metrics correlation (regression test for principal tenure)

Run this after changes to:
- `ESSENTIAL_SCHOOL_FIELDS` (tool result summarization)
- `analyze_correlations` metrics
- System prompt guidance
- Evaluation rubric in `src/lib/ai/evaluation.ts`
- `src/lib/db/__tests__/fixtures.ts`: Representative test data for all school types and categories

## Common Tasks

### Re-seed the database
```bash
npx tsx scripts/seed-database.ts
```

### Add a new MCP tool
1. Create tool file in `src/lib/mcp/tools/`
2. Add tool definition to `TOOL_DEFINITIONS` in `src/lib/mcp/index.ts`
3. Add case to `executeTool()` switch statement
4. Ensure response includes `_context` with limitations

### Modify pre-filter patterns
Edit `BLOCKED_PATTERNS` or `FLAG_PATTERNS` in `src/lib/ai/prefilter.ts`

### Update system prompt
Edit `SYSTEM_PROMPT` in `src/lib/ai/system-prompt.ts`

### Deployment

Deploy to Google Cloud Run with automatic CI/CD via GitHub Actions.

```bash
# Test locally with Docker
docker build -t nyc-school-explorer .
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=your-key \
  -e GEMINI_API_KEY=your-key \
  nyc-school-explorer

# Deploy (automatic on push to main)
git push origin main
```

See `docs/deployment.md` for full setup instructions including GCP configuration and GitHub secrets.

### Update the database for deployment

The SQLite database (`data/schools.db`) is committed to the repo and baked into the container.

```bash
# Re-seed with new data
npx tsx scripts/seed-database.ts

# Commit and deploy
git add data/schools.db
git commit -m "Update database"
git push
```

## Data Statistics

### School Metrics by Year
- 2022-23: 1,863 schools (no Impact/Performance scores)
- 2023-24: 1,867 schools
- 2024-25: 1,874 schools

### All School Types (2024-25)
- Total schools: 1,894
- With metrics: 1,874

### EMS Only (Scope of High Growth Analysis)
- High-poverty EMS schools: ~710
- High Growth (EMS): Query dynamically
- Strong Growth + Outcomes (EMS): Query dynamically
- Strong Outcomes, Moderate Growth (EMS): Query dynamically
- Persistent High Growth (EMS): Query dynamically

### Citywide Medians
- Median Impact Score: 0.50
- Median Performance Score: 0.49
- Median ENI: 0.866

**Note**: Category counts should be queried dynamically using `getEMSCategoryStats()` rather than hardcoded. The numbers above are approximate.

## Known Limitations

- Only 2 years of Impact Score data available (2023-24, 2024-25); 2022-23 has other metrics but no Impact/Performance scores
- Impact Score methodology not fully disclosed by NYC DOE
- No student mobility data (can't rule out selection effects)
- Charter school budget data not comparable to DOE-managed schools
- Many high growth schools don't persist year-over-year
- No teacher-level or curriculum data
- Suspension data contains redacted values ("R") for small counts (1-5) due to privacy
- Suspension rates correlate with poverty and systemic bias
- PTA income reflects parent wealth, not school quality
- Budget % funded does not account for grants, donations, or PTA contributions
