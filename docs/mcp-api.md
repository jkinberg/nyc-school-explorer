# MCP API Documentation

The NYC School Explorer exposes an MCP (Model Context Protocol) HTTP endpoint that allows external AI agents to query school data programmatically.

## Overview

```
External AI Agent (Claude Desktop, other MCP clients)
  ↓
POST /api/mcp (JSON-RPC 2.0)
  ↓
executeTool(name, params)
  ↓
SQLite database queries
  ↓
Structured JSON response
```

**Key Point:** Your Anthropic/Gemini API keys are NOT used by the MCP endpoint. It only executes database queries and returns data. External AI agents use their own LLM providers.

## Endpoint

```
POST /api/mcp
Content-Type: application/json
```

## Authentication

No authentication required. Rate limited to 60 requests/minute per IP.

## Protocol

Uses JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "method": "method-name",
  "params": { ... }
}
```

## Methods

### `initialize`

Protocol handshake. Call this first to establish connection.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "clientInfo": {
      "name": "your-client",
      "version": "1.0.0"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "nyc-schools-data",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": {}
    }
  }
}
```

### `tools/list`

Returns all available tools.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "result": {
    "tools": [
      {
        "name": "search_schools",
        "description": "Search NYC schools by various criteria...",
        "inputSchema": { ... }
      },
      ...
    ]
  }
}
```

### `tools/call`

Execute a tool and return results.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "tools/call",
  "params": {
    "name": "search_schools",
    "arguments": {
      "borough": "Brooklyn",
      "limit": 5
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"schools\": [...], \"_context\": {...}}"
      }
    ]
  }
}
```

## Available Tools

| Tool | Purpose |
|------|---------|
| `search_schools` | Filter schools by borough, category, metrics; supports sorting by any metric |
| `get_school_profile` | Detailed school view with trends |
| `find_similar_schools` | Find peer schools by ENI/enrollment |
| `compare_schools` | Compare 2-10 schools side-by-side across metrics |
| `analyze_correlations` | Calculate correlation between any of 19 metrics (see below) |
| `generate_chart` | Create chart data for visualization (scatter, bar, histogram, diverging_bar) |
| `explain_metrics` | Educational content on methodology |
| `get_curated_lists` | Pre-computed school categories |

### Tool Examples

#### search_schools

Find Brooklyn schools with high impact scores:

```json
{
  "name": "search_schools",
  "arguments": {
    "borough": "Brooklyn",
    "min_impact_score": 0.6,
    "limit": 10
  }
}
```

Find EMS schools with lowest student attendance (sorted ascending):

```json
{
  "name": "search_schools",
  "arguments": {
    "report_type": "EMS",
    "sort_by": "student_attendance",
    "sort_order": "asc",
    "limit": 10
  }
}
```

**Sorting options:**
- `sort_by`: `impact_score`, `performance_score`, `economic_need_index`, `enrollment`, `student_attendance`, `teacher_attendance`, `principal_years`, `pct_teachers_3plus_years`, `name`
- `sort_order`: `asc` (lowest first) or `desc` (highest first, default)

**Natural language sorting (in chat):** The AI maps common phrases to sort parameters:
| User Says | Maps To |
|-----------|---------|
| "worst/lowest attendance" | `sort_by="student_attendance", sort_order="asc"` |
| "largest schools" | `sort_by="enrollment", sort_order="desc"` |
| "highest impact" | `sort_by="impact_score", sort_order="desc"` |
| "highest poverty" | `sort_by="economic_need_index", sort_order="desc"` |

#### get_school_profile

Get detailed info for a specific school:

```json
{
  "name": "get_school_profile",
  "arguments": {
    "dbn": "01M188"
  }
}
```

#### find_similar_schools

Find schools similar to a reference school:

```json
{
  "name": "find_similar_schools",
  "arguments": {
    "dbn": "01M188",
    "match_criteria": ["economic_need", "enrollment"],
    "limit": 5
  }
}
```

#### compare_schools

Compare 2-10 schools across key metrics in a table format.

**Compare specific schools by DBN or name:**

```json
{
  "name": "compare_schools",
  "arguments": {
    "dbns": ["01M188", "02M475"],
    "compare_to_citywide": true
  }
}
```

**Compare to similar peers:**

```json
{
  "name": "compare_schools",
  "arguments": {
    "dbns": ["01M188"],
    "compare_to_similar": true,
    "limit": 5
  }
}
```

**Compare filtered group (e.g., top Brooklyn high-growth schools):**

```json
{
  "name": "compare_schools",
  "arguments": {
    "filter": { "borough": "Brooklyn", "category": "high_growth" },
    "limit": 5
  }
}
```

**Include year-over-year trends:**

```json
{
  "name": "compare_schools",
  "arguments": {
    "dbns": ["13K123", "09X456"],
    "include_trends": true
  }
}
```

**Available metrics:**
- Core (default): `impact_score`, `performance_score`, `economic_need_index`, `enrollment`
- Attendance (default): `student_attendance`, `teacher_attendance`
- Staff: `principal_years`, `pct_teachers_3plus_years`
- Budget: `total_budget`, `pct_funded` (charter budgets not comparable)
- PTA: `pta_income` (reflects parent wealth)
- Suspensions: `total_suspensions` (may be redacted)
- Surveys: `survey_family_involvement`, `survey_family_trust`, `survey_safety`, etc.
- Ratings: `rating_instruction`, `rating_safety`, `rating_families`
- Category: `category`

#### analyze_correlations

Calculate correlation between two metrics. Returns Pearson correlation coefficient (r), sample size, and means.

**Available metrics (19 total):**

| Category | Metrics |
|----------|---------|
| Core | `impact_score`, `performance_score`, `economic_need_index`, `enrollment` |
| Attendance | `student_attendance`, `teacher_attendance` |
| Staff | `principal_years`, `pct_teachers_3plus_years` |
| Budget | `total_budget`, `pct_funded`, `pta_income` |
| Suspensions | `total_suspensions` |
| Surveys | `survey_family_involvement`, `survey_family_trust`, `survey_safety`, `survey_communication`, `survey_instruction`, `survey_leadership`, `survey_support` |

**Example - Poverty vs. test scores:**

```json
{
  "name": "analyze_correlations",
  "arguments": {
    "metric1": "economic_need_index",
    "metric2": "performance_score"
  }
}
```

**Example - Family engagement vs. student growth:**

```json
{
  "name": "analyze_correlations",
  "arguments": {
    "metric1": "survey_family_involvement",
    "metric2": "impact_score"
  }
}
```

**Example - Principal tenure vs. growth (filtered to high-poverty schools):**

```json
{
  "name": "analyze_correlations",
  "arguments": {
    "metric1": "principal_years",
    "metric2": "impact_score",
    "filter": {
      "min_eni": 0.85
    }
  }
}
```

#### generate_chart

Create chart data for visualization. Supports multiple chart types:

**Diverging bar chart** - Shows values above/below a threshold:

```json
{
  "name": "generate_chart",
  "arguments": {
    "chart_type": "diverging_bar",
    "x_metric": "impact_score",
    "filter": { "borough": "Bronx" },
    "limit": 30
  }
}
```

**Diverging bar with year-over-year change**:

```json
{
  "name": "generate_chart",
  "arguments": {
    "chart_type": "diverging_bar",
    "x_metric": "impact_score",
    "show_change": true
  }
}
```

**Chart types:**
- `scatter`: Scatter plot for correlation exploration
- `bar`: Bar chart for categorical comparison
- `histogram`: Distribution of a single metric
- `yoy_change`: Year-over-year comparison (scatter format)
- `diverging_bar`: Values above/below a threshold (horizontal bars)

**Diverging bar parameters:**
- `midpoint`: Threshold value (default: 0.50 for Impact, 0.49 for Performance, 0.90 for attendance)
- `show_change`: If true, calculates year-over-year change (midpoint defaults to 0)

#### get_curated_lists

Get pre-computed school categories:

```json
{
  "name": "get_curated_lists",
  "arguments": {
    "list_type": "high_growth",
    "borough": "Bronx",
    "limit": 10
  }
}
```

## Error Codes

| Code | Meaning |
|------|---------|
| `-32700` | Parse error - Invalid JSON |
| `-32600` | Invalid request - Missing required fields |
| `-32601` | Method not found |
| `-32602` | Invalid params - Unknown tool or bad arguments |
| `-32603` | Internal error - Tool execution failed |
| `-32002` | Rate limit exceeded |

**Error Response Format:**
```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

## Rate Limiting

- **Limit:** 60 requests/minute per IP
- **Response when exceeded:** HTTP 429 with JSON-RPC error code `-32002`
- **Retry-After:** Included in error data

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32002,
    "message": "Rate limit exceeded",
    "data": {
      "retryAfter": 45
    }
  }
}
```

## Claude Desktop Configuration

After deployment, add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nyc-schools": {
      "url": "https://nyc-school-explorer-w27tadi35a-uc.a.run.app/api/mcp"
    }
  }
}
```

## Testing

### List tools

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}'
```

### Call a tool

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"search_schools","arguments":{"borough":"Brooklyn","limit":3}}}'
```

### Health check

```bash
curl http://localhost:3000/api/mcp
```

## Monitoring & Abuse Mitigation

### Request Logging

Each MCP request logs method, tool name (if applicable), and client IP:

```
[MCP] method=tools/call tool=search_schools ip=1.2.3.4
```

### Google Cloud Monitoring

View metrics in Cloud Run Dashboard:
- Request count
- Latency
- Error rate

View logs:
```bash
gcloud run services logs read nyc-school-explorer --region=us-central1 --limit=50
```

Filter MCP requests:
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND httpRequest.requestUrl:"/api/mcp"' \
  --limit=100 --format="table(timestamp, httpRequest.remoteIp, httpRequest.status)"
```

### Signs of Abuse

- Single IP making >100 requests/minute
- Sudden 10x spike in request count
- High error rate (scanning for vulnerabilities)

### Response Playbook

**Level 1 - Suspicious activity:** Monitor for 24 hours, rate limiting handles it.

**Level 2 - Confirmed abuse (single IP):** Block via Cloud Armor or update ingress settings.

**Level 3 - Widespread abuse:** Add API key authentication (code change required).
