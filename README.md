# NYC School Explorer

An AI-native data journalism tool for exploring NYC School Quality Report data through natural language conversation, with responsible AI guardrails and transparent methodology.

## Features

- **Natural language chat** powered by Claude for querying NYC school data
- **Three-layer AI guardrails**: pre-filter, system prompt, and tool-level context to ensure responsible framing
- **LLM-as-judge evaluation**: every response is scored on factual accuracy, context inclusion, limitation acknowledgment, responsible framing, and query relevance -- scores are shown in the chat UI
- **MCP tools** for school search, profiles, correlations, charts, and curated lists
- **Interactive charts** via Recharts for data visualization
- **School profiles** with year-over-year comparison

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

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Database**: SQLite with better-sqlite3
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514 for chat), Google Gemini (gemini-3-flash-preview for evaluation)
- **Charts**: Recharts
- **Styling**: Tailwind CSS 4

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | -- | Anthropic API key for chat |
| `GEMINI_API_KEY` | No | -- | Google Gemini API key for LLM-as-judge evaluation |
| `ENABLE_EVALUATION` | No | `true` | Set to `false` to disable LLM-as-judge response scoring |
| `RATE_LIMIT_ENABLED` | No | `true` | Set to `false` to disable rate limiting |

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
