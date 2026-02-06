# NYC School Explorer

An AI-native data journalism tool for exploring NYC School Quality Report data through natural language conversation, with responsible AI guardrails and transparent methodology.

## Features

- **Natural language chat** powered by Claude for querying NYC school data
- **Three-layer AI guardrails**: pre-filter, system prompt, and tool-level context to ensure responsible framing
- **LLM-as-judge evaluation**: every response is scored on factual accuracy, context inclusion, limitation acknowledgment, responsible framing, and query relevance -- scores are shown in the chat UI
- **Evaluation logging**: low-scoring responses (< 75) are auto-logged; users can flag any response with feedback via modal
- **MCP tools** for school search (with natural language sorting), profiles, comparisons, correlations (19 metrics including surveys and staff data), charts, and curated lists
- **Interactive charts** via Recharts for data visualization with PNG/CSV export
- **School profiles** with year-over-year comparison
- **Copy and export**: copy response text, export charts as PNG or CSV, copy evaluation scores

### Chat Interface

- **Rich markdown rendering**: tables, lists, code blocks with proper styling via react-markdown
- **Auto-linked school names**: school names in responses link directly to profile pages (opens in new tab)
- **Tool visibility**: collapsible cards show when Claude is searching, analyzing, or generating charts
- **Smart scrolling**: no auto-scroll during streaming; floating "scroll to bottom" button when reading history
- **Contextual follow-ups**: AI-generated suggestions reference specific schools, boroughs, and metrics from the conversation
- **Copy response text**: copy button on each AI response to copy plain text to clipboard
- **Export charts**: download charts as PNG (high-resolution) or CSV (with proper escaping)
- **Copy evaluation**: copy button in evaluation dropdown to copy scores and summary

## Getting Started

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

Open [http://localhost:3000](http://localhost:3000) and navigate to the Explore page to start chatting.

### Running Tests

```bash
npm run test           # Watch mode
npm run test:run       # Run once (CI)
npm run test:coverage  # With coverage report
```

**328 tests** across 12 test files, running in ~1.5 seconds:

| Module | Tests | Focus |
|--------|-------|-------|
| AI Guardrails | 77 | Prefilter patterns, evaluation scoring |
| MCP Tools | 109 | Search filtering, profile lookup, comparison, context, sorting |
| Utilities | 73 | Formatting, fuzzy matching |
| Database Logic | 35 | Abbreviations, correlations, categories |
| UI Components | 34 | Chart export, copy functionality |

### Testing the Evaluation Rubric

To test the LLM-as-judge evaluation against production:

```bash
npx tsx scripts/test-evaluation-rubric.ts https://your-production-url.run.app
```

This runs 12 test queries and reports on factual accuracy scores and evaluation flags. Use this after making changes to tool results, correlation metrics, or system prompt guidance.

See [CLAUDE.md](CLAUDE.md#testing) for detailed testing documentation.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Database**: SQLite with better-sqlite3
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514 for chat), Google Gemini (gemini-3-flash-preview for evaluation)
- **Charts**: Recharts
- **Markdown**: react-markdown with remark-gfm
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest with React Testing Library

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | -- | Anthropic API key for chat |
| `GEMINI_API_KEY` | No | -- | Google Gemini API key for LLM-as-judge evaluation |
| `ENABLE_EVALUATION` | No | `true` | Set to `false` to disable LLM-as-judge response scoring |
| `RATE_LIMIT_ENABLED` | No | `true` | Set to `false` to disable rate limiting |
| `ZAPIER_WEBHOOK_URL` | No | -- | Zapier webhook URL for logging evaluations to Google Sheets |

## Data Sources

- NYC DOE School Quality Reports (2022-23, 2023-24, 2024-25) — Impact/Performance scores only available for 2023-24+
- LCGMS + ShapePoints for school locations
- LL16 Budget Reports (2022-23 through 2024-25)
- LL93 Suspension Reports (2022-23 through 2024-25)
- PTA Financial Reporting (2022-23 through 2024-25)

## MCP API

The app exposes an MCP (Model Context Protocol) HTTP endpoint at `/api/mcp` that allows external AI agents (like Claude Desktop) to query school data programmatically.

- **Endpoint:** `POST /api/mcp`
- **Format:** JSON-RPC 2.0
- **Rate limit:** 60 requests/minute per IP
- **No authentication required**

See [docs/mcp-api.md](docs/mcp-api.md) for full API documentation.

## Evaluation Logging

The system logs AI responses for quality review:

- **Auto-logging**: Responses with evaluation score < 75 are automatically logged
- **User flagging**: Users can click "Flag" on any response to submit feedback via modal
- **Storage**: Logs are sent to Zapier webhook (for Google Sheets) and saved locally to `logs/evaluations.jsonl`
- **Analysis**: Run `npx tsx scripts/analyze-logs.ts` to analyze logged responses

See [docs/evaluation-logging.md](docs/evaluation-logging.md) for Zapier/Google Sheets setup.

## Deployment

Deployed to **Google Cloud Run** with automatic CI/CD via GitHub Actions.

```bash
# Test locally with Docker
docker build -t nyc-school-explorer .
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=your-key \
  -e GEMINI_API_KEY=your-key \
  nyc-school-explorer
```

Push to `main` to deploy automatically. See [docs/deployment.md](docs/deployment.md) for full setup instructions.

## License

Private project.
