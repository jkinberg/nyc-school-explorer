/**
 * MCP Tools Index
 *
 * This module exports all MCP tools and their definitions for use with Claude API.
 */

// Tool implementations
export { searchSchoolsTool, searchSchoolsDefinition } from './tools/search-schools';
export { getSchoolProfileTool, getSchoolProfileDefinition } from './tools/get-school-profile';
export { findSimilarSchoolsTool, findSimilarSchoolsDefinition } from './tools/find-similar-schools';
export { analyzeCorrelationsTool, analyzeCorrelationsDefinition } from './tools/analyze-correlations';
export { generateChartTool, generateChartDefinition } from './tools/generate-chart';
export { explainMetricsTool, explainMetricsDefinition } from './tools/explain-metrics';
export { getCuratedListsTool, getCuratedListsDefinition } from './tools/get-curated-lists';

// All tool definitions for Claude API
export const ALL_TOOL_DEFINITIONS = [
  {
    name: 'search_schools',
    description: `Search NYC schools by various criteria. Returns schools with required context.

IMPORTANT USAGE GUIDANCE:
- Results always include Economic Need (ENI) alongside performance metrics
- Impact Score (student growth) is less confounded by poverty than Performance Score
- Never present results as a ranking of "best" or "worst" schools
- Always note sample size and data limitations when presenting findings`,
    input_schema: {
      type: 'object',
      properties: {
        borough: {
          type: 'string',
          enum: ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'],
          description: 'Filter by NYC borough'
        },
        report_type: {
          type: 'string',
          enum: ['EMS', 'HS', 'HST', 'EC', 'D75'],
          description: 'Filter by school report type'
        },
        min_impact_score: { type: 'number', description: 'Minimum Impact Score (0-1)' },
        max_impact_score: { type: 'number', description: 'Maximum Impact Score (0-1)' },
        min_eni: { type: 'number', description: 'Minimum Economic Need Index (0-1)' },
        max_eni: { type: 'number', description: 'Maximum Economic Need Index (0-1)' },
        category: {
          type: 'string',
          enum: ['elite', 'hidden_gem', 'anomaly', 'typical'],
          description: 'Filter by pre-computed category'
        },
        year: { type: 'string', enum: ['2023-24', '2024-25'], default: '2024-25' },
        limit: { type: 'number', default: 25, maximum: 100 },
        min_pct_funded: { type: 'number', description: 'Minimum FSF % funded (0-1)' },
        max_pct_funded: { type: 'number', description: 'Maximum FSF % funded (0-1)' },
        council_district: { type: 'number', description: 'NYC Council district number' },
        nta: { type: 'string', description: 'Neighborhood Tabulation Area name' }
      }
    }
  },
  {
    name: 'get_school_profile',
    description: `Get detailed profile for a specific school including metrics across both years, trends, similar schools, location, budget, suspensions, and PTA data.`,
    input_schema: {
      type: 'object',
      properties: {
        dbn: { type: 'string', description: 'District-Borough-Number (e.g., "01M188")' },
        include_similar: { type: 'boolean', default: true }
      },
      required: ['dbn']
    }
  },
  {
    name: 'find_similar_schools',
    description: `Find schools with similar characteristics for contextual comparison. Matches by ENI (±0.05) and enrollment (±20%) by default.`,
    input_schema: {
      type: 'object',
      properties: {
        dbn: { type: 'string', description: 'DBN of reference school' },
        match_criteria: {
          type: 'array',
          items: { type: 'string', enum: ['economic_need', 'enrollment', 'borough', 'report_type'] },
          default: ['economic_need', 'enrollment']
        },
        limit: { type: 'number', default: 5 }
      },
      required: ['dbn']
    }
  },
  {
    name: 'analyze_correlations',
    description: `Calculate correlation between metrics. IMPORTANT: Correlation does not imply causation. Always present with caveats.`,
    input_schema: {
      type: 'object',
      properties: {
        metric1: {
          type: 'string',
          enum: ['impact_score', 'performance_score', 'economic_need_index', 'student_attendance', 'enrollment', 'total_budget', 'pct_funded', 'total_suspensions', 'pta_income']
        },
        metric2: {
          type: 'string',
          enum: ['impact_score', 'performance_score', 'economic_need_index', 'student_attendance', 'enrollment', 'total_budget', 'pct_funded', 'total_suspensions', 'pta_income']
        },
        filter: {
          type: 'object',
          properties: {
            min_eni: { type: 'number' },
            category: { type: 'string' }
          }
        }
      },
      required: ['metric1', 'metric2']
    }
  },
  {
    name: 'generate_chart',
    description: `Generate data for visualization. Returns structured data for client-side rendering with Recharts.`,
    input_schema: {
      type: 'object',
      properties: {
        chart_type: { type: 'string', enum: ['scatter', 'bar', 'histogram'] },
        x_metric: { type: 'string' },
        y_metric: { type: 'string', description: 'Required for scatter plots' },
        color_by: { type: 'string', enum: ['category', 'borough', 'is_charter'] },
        title: { type: 'string' },
        limit: { type: 'number', default: 500 }
      },
      required: ['chart_type', 'x_metric']
    }
  },
  {
    name: 'explain_metrics',
    description: `Get educational content about metrics and methodology. Use when users ask "what does X mean?"`,
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: ['impact_score', 'performance_score', 'economic_need_index', 'hidden_gems', 'categories', 'methodology', 'limitations', 'budget_funding', 'suspensions', 'pta_finances', 'school_location']
        }
      },
      required: ['topic']
    }
  },
  {
    name: 'get_curated_lists',
    description: `Retrieve pre-computed school categories (Hidden Gems, Elite, etc.). Use for "schools beating the odds" queries.`,
    input_schema: {
      type: 'object',
      properties: {
        list_type: {
          type: 'string',
          enum: ['hidden_gems', 'persistent_gems', 'elite', 'anomalies', 'all_high_impact']
        },
        borough: { type: 'string', enum: ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'] },
        sort_by: { type: 'string', enum: ['impact_score', 'name', 'enrollment'], default: 'impact_score' },
        limit: { type: 'number', default: 50 }
      },
      required: ['list_type']
    }
  }
];

// Tool executor - routes tool calls to implementations
export function executeTool(name: string, params: Record<string, unknown>): unknown {
  switch (name) {
    case 'search_schools':
      const { searchSchoolsTool } = require('./tools/search-schools');
      return searchSchoolsTool(params);

    case 'get_school_profile':
      const { getSchoolProfileTool } = require('./tools/get-school-profile');
      return getSchoolProfileTool(params);

    case 'find_similar_schools':
      const { findSimilarSchoolsTool } = require('./tools/find-similar-schools');
      return findSimilarSchoolsTool(params);

    case 'analyze_correlations':
      const { analyzeCorrelationsTool } = require('./tools/analyze-correlations');
      return analyzeCorrelationsTool(params);

    case 'generate_chart':
      const { generateChartTool } = require('./tools/generate-chart');
      return generateChartTool(params);

    case 'explain_metrics':
      const { explainMetricsTool } = require('./tools/explain-metrics');
      return explainMetricsTool(params);

    case 'get_curated_lists':
      const { getCuratedListsTool } = require('./tools/get-curated-lists');
      return getCuratedListsTool(params);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
