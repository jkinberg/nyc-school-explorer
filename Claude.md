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
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Charts**: Recharts
- **Styling**: Tailwind CSS 4

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Home page
│   ├── explore/page.tsx          # AI Chat interface (primary feature)
│   ├── gems/page.tsx             # Hidden Gems list
│   ├── search/page.tsx           # Filter/search schools
│   ├── about/page.tsx            # Methodology documentation
│   ├── school/[dbn]/page.tsx     # Individual school profile
│   └── api/
│       ├── chat/route.ts         # Main chat endpoint with Claude
│       └── schools/              # REST API for school data
├── components/
│   ├── chat/                     # Chat interface components
│   ├── schools/                  # School display components
│   └── common/                   # Shared components
├── lib/
│   ├── ai/                       # AI guardrails
│   │   ├── prefilter.ts          # Pre-filter harmful queries
│   │   ├── system-prompt.ts      # Claude system prompt
│   │   └── evaluation.ts         # LLM-as-judge scoring
│   ├── db/                       # Database layer
│   │   ├── connection.ts         # SQLite connection
│   │   └── queries.ts            # Query functions
│   ├── mcp/                      # MCP tools
│   │   ├── index.ts              # Tool definitions & executor
│   │   └── tools/                # Individual tool implementations
│   └── utils/                    # Helpers (formatting, rate-limit)
└── types/                        # TypeScript types
    ├── school.ts                 # School-related types
    └── chat.ts                   # Chat-related types
```

## Key Concepts

### School Categories (EMS Only)

**IMPORTANT**: The four-group framework was validated for **Elementary/Middle Schools (EMS) only**. High Schools and other school types show different patterns.

Schools are categorized based on three thresholds (computed during data import):

| Category | Impact Score | Performance Score | ENI | Scope |
|----------|-------------|-------------------|-----|-------|
| **Elite** | >= 0.60 | >= 0.50 | >= 0.85 | EMS |
| **Hidden Gem** | >= 0.60 | < 0.50 | >= 0.85 | EMS |
| **Anomaly** | < 0.60 | >= 0.50 | >= 0.85 | EMS |
| **Typical** | < 0.60 | < 0.50 | >= 0.85 | EMS |
| **Low Poverty** | any | any | < 0.85 | EMS |

- **Impact Score**: Measures student growth relative to similar students (less correlated with poverty)
- **Performance Score**: Measures absolute outcomes (strongly correlated with poverty, r = -0.69)
- **ENI (Economic Need Index)**: Poverty indicator (0-1 scale)

### Persistent Gems

Elementary/Middle Schools that maintained high-impact status (Hidden Gem or Elite category) in BOTH 2023-24 and 2024-25 school years. Query `getPersistentGems('EMS')` for current count.

### Scope Considerations

The original Hidden Gems analysis was conducted on EMS data only. Key implications:
- Default API queries filter to `report_type='EMS'`
- The `get_curated_lists` tool defaults to EMS
- When discussing categories, always specify "Among Elementary/Middle Schools..."
- Counts in the database differ between EMS-only and all school types

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
| `search_schools` | Filter schools by borough, category, metrics |
| `get_school_profile` | Detailed school view with YoY comparison |
| `find_similar_schools` | Find peer schools by ENI (±5%) and enrollment (±20%) |
| `analyze_correlations` | Calculate correlation between metrics |
| `generate_chart` | Return data for Recharts visualizations |
| `explain_metrics` | Educational content about methodology |
| `get_curated_lists` | Pre-computed Hidden Gems, Elite, Persistent Gems lists |

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
| `/api/schools` | GET | Search schools with query params |
| `/api/schools/[dbn]` | GET | Get individual school profile |
| `/api/schools/gems` | GET | Get curated lists (type=hidden_gems\|persistent_gems\|elite) |

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
3. If blocked, return reframe immediately
4. Call Claude with system prompt and tool definitions
5. Execute any tool calls Claude requests
6. Return streaming response
7. Fire async evaluation (non-blocking, for quality monitoring)

### Responsible Framing

When modifying or adding features, maintain these principles:
- Never present metrics in isolation (always include ENI context)
- Prefer Impact Score when discussing "quality" or "effectiveness"
- Use uncertainty language for all findings
- Present multiple hypotheses for patterns (not just "good teaching")
- Refuse to rank schools "best to worst"
- Refuse demographic filtering queries

## Data Sources

NYC DOE School Quality Reports (2023-24 and 2024-25):
- Elementary/Middle/K-8 (EMS reports)
- High School (HS reports)
- High School Transfer (HST reports)
- District 75 (D75 reports)
- Early Childhood (EC reports)

Additional data sources:
- **LCGMS** (Location Code Management System) + ShapePoints DBF for school locations and coordinates
- **LL16 Budget Reports** (2022-23, 2023-24, 2024-25) - Fair Student Funding allocations
- **LL93 Suspension Reports** (2022-23, 2023-24, 2024-25) - Student discipline data
- **PTA Financial Reporting** (2022-23, 2023-24, 2024-25) - PTA income, expenses, and balance

Raw Excel files are in `/Users/josh/Projects/nyc-schools-data/data-samples/raw/`

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...  # Required for chat functionality
```

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

## Data Statistics (2024-25)

### All School Types
- Total schools: 1,889
- With metrics: 1,740

### EMS Only (Scope of Hidden Gems Analysis)
- High-poverty EMS schools: ~710
- Hidden Gems (EMS): ~17
- Elite (EMS): ~105
- Anomalies (EMS): ~73
- Persistent Gems (EMS): Query dynamically

### Citywide Medians
- Median Impact Score: 0.50
- Median Performance Score: 0.49
- Median ENI: 0.866

**Note**: Category counts should be queried dynamically using `getEMSCategoryStats()` rather than hardcoded. The numbers above are approximate.

## Known Limitations

- Only 2 years of Impact Score data available
- Impact Score methodology not fully disclosed by NYC DOE
- No student mobility data (can't rule out selection effects)
- Charter school budget data not comparable to DOE-managed schools
- 39% of Hidden Gems don't persist year-over-year
- No teacher-level or curriculum data
- Suspension data contains redacted values ("R") for small counts (1-5) due to privacy
- Suspension rates correlate with poverty and systemic bias
- PTA income reflects parent wealth, not school quality
- Budget % funded does not account for grants, donations, or PTA contributions
