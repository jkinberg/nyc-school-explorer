import { METRIC_EXPLANATIONS } from '@/types/school';
import type { MetricExplanation, ResponseContext } from '@/types/school';
import { getCitywideStats } from '@/lib/db/queries';

export interface ExplainMetricsParams {
  topic: 'impact_score' | 'performance_score' | 'economic_need_index' | 'high_growth_framework' | 'categories' | 'methodology' | 'limitations' | 'budget_funding' | 'suspensions' | 'pta_finances' | 'school_location';
}

export interface ExplainMetricsResult {
  topic: string;
  explanation: MetricExplanation | string;
  _context: ResponseContext;
}

// Additional explanations not in types
const ADDITIONAL_EXPLANATIONS: Record<string, string> = {
  categories: `## School Categories

**IMPORTANT SCOPE NOTE**: This four-group framework was designed and validated for **Elementary/Middle Schools (EMS) only**. High Schools and other school types show different score distributions and patterns. Use get_curated_lists tool to get current counts.

High-poverty Elementary/Middle Schools (ENI ≥ 0.85) are classified into four categories based on their Impact and Performance scores:

### Strong Growth + Strong Outcomes (high_growth_high_achievement)
- **Criteria**: Impact Score ≥ 0.55 AND Performance Score ≥ 0.50
- **What it means**: These schools achieve both strong student growth AND strong absolute outcomes while serving high-poverty populations
- **Count**: Use get_curated_lists(list_type="high_growth_high_achievement") for current count

### Strong Growth, Building Outcomes (high_growth)
- **Criteria**: Impact Score ≥ 0.55 AND Performance Score < 0.50
- **What it means**: Exceptional student growth despite lower absolute test scores. Students arrive behind but learn at an above-average rate
- **Count**: Use get_curated_lists(list_type="high_growth") for current count
- **Caution**: We cannot determine WHY these schools show high growth

### Strong Outcomes, Moderate Growth (high_achievement)
- **Criteria**: Impact Score < 0.55 AND Performance Score ≥ 0.50
- **What it means**: Strong absolute scores but moderate growth. Students may arrive well-prepared
- **Count**: Use get_curated_lists(list_type="high_achievement") for current count

### Developing on Both Metrics (developing)
- **Criteria**: Neither high Impact nor high Performance
- **What it means**: Schools facing the challenges common to high-poverty environments
- **Count**: Majority of high-poverty EMS schools

### Persistent High Growth
- Elementary/Middle Schools that maintained strong growth status in BOTH 2023-24 and 2024-25
- Two years of consistency suggests something real, but still doesn't prove causation
- Use get_curated_lists(list_type="persistent_high_growth") for current count

### Why EMS Only?
The thresholds (Impact ≥ 0.55, Performance ≥ 0.50) were derived from EMS data distributions. High Schools have different score patterns and would need separate threshold validation.`,

  methodology: `## Data Methodology

### Data Sources
- NYC DOE School Quality Reports (2022-23, 2023-24, 2024-25)
- Elementary/Middle Schools (EMS), High Schools (HS), Transfer Schools (HST), Early Childhood (EC), D75
- PTA Financial Reporting data (2022-23, 2023-24, 2024-25)
- LCGMS School Location Data + ShapePoints geographic coordinates
- Local Law 16 Budget Reports (2022-23, 2023-24, 2024-25)
- Local Law 93 Student Suspension Reports (2022-23, 2023-24, 2024-25)

### Impact Score
The DOE's Impact Score measures student growth relative to similar students citywide. A score of 0.55 means students at this school grew more than 55% of students with similar starting points.

**Important**: The exact methodology is not fully disclosed by the DOE.

### Performance Score
A composite of test scores and other outcome measures. Correlates strongly with poverty (r = -0.69).

### Economic Need Index (ENI)
Calculated from:
- Temporary housing status
- HRA eligibility
- Free/reduced lunch data

Higher values indicate higher poverty.

### Category Assignment (EMS Only)
Categories are pre-computed using fixed thresholds **for Elementary/Middle Schools only**:
- High Impact: ≥ 0.55
- High Performance: ≥ 0.50
- High Poverty: ENI ≥ 0.85

**Scope Note**: These thresholds were validated against EMS data. High Schools and other school types have different score distributions and are stored with categories computed using the same thresholds, but the framework was not validated for those school types.`,

  limitations: `## Data Limitations

### What This Data Cannot Tell You

1. **Why schools perform differently**
   - No data on curriculum, teaching methods, or leadership quality
   - No classroom-level or teacher-level data

2. **Causation**
   - Correlations do not prove causes
   - High Impact Score does not prove "better teaching"
   - Multiple explanations exist for every pattern

3. **Selection Effects**
   - No student mobility data
   - Cannot rule out students leaving or being counseled out
   - Charter lottery winners may differ from non-winners

4. **Long-term Patterns**
   - Only 2 years of Impact Score data
   - Many schools don't maintain category year-over-year
   - Results may not persist

5. **Charter Comparisons**
   - Budget data not comparable between sectors
   - Different accountability structures
   - Selection into charter schools

### What To Be Careful About

- Don't use this data to rank schools "best to worst"
- Don't filter by demographics for school selection
- Don't claim proof of what works
- Don't ignore poverty context when comparing schools`
};

/**
 * Get educational content about metrics, methodology, and limitations.
 */
export function explainMetricsTool(params: ExplainMetricsParams): ExplainMetricsResult {
  const { topic } = params;
  const citywideStats = getCitywideStats('2024-25');

  // Check if it's a metric explanation
  const metricExplanation = METRIC_EXPLANATIONS[topic];
  if (metricExplanation) {
    return {
      topic,
      explanation: metricExplanation,
      _context: {
        sample_size: 0,
        data_year: '2024-25',
        citywide_medians: {
          impact: citywideStats?.median_impact_score || 0.50,
          performance: citywideStats?.median_performance_score || 0.50,
          eni: citywideStats?.median_economic_need || 0.72
        },
        limitations: []
      }
    };
  }

  // Check additional explanations
  const additionalExplanation = ADDITIONAL_EXPLANATIONS[topic];
  if (additionalExplanation) {
    return {
      topic,
      explanation: additionalExplanation,
      _context: {
        sample_size: 0,
        data_year: '2024-25',
        citywide_medians: {
          impact: citywideStats?.median_impact_score || 0.50,
          performance: citywideStats?.median_performance_score || 0.50,
          eni: citywideStats?.median_economic_need || 0.72
        },
        limitations: []
      }
    };
  }

  // Unknown topic
  return {
    topic,
    explanation: `Topic "${topic}" not found. Available topics: impact_score, performance_score, economic_need_index, high_growth_framework, categories, methodology, limitations, budget_funding, suspensions, pta_finances, school_location`,
    _context: {
      sample_size: 0,
      data_year: '2024-25',
      citywide_medians: {
        impact: 0.50,
        performance: 0.50,
        eni: 0.72
      },
      limitations: []
    }
  };
}

export const explainMetricsDefinition = {
  name: 'explain_metrics',
  description: `Provide educational content about NYC School Quality Report methodology.

Topics include:
- impact_score: What it measures, how it's calculated (as much as is known), limitations
- performance_score: Components, correlation with poverty, what it captures
- economic_need_index: How ENI is calculated, what it represents
- high_growth_framework: The four-groups framework and what it means
- categories: Explanation of high_growth_high_achievement, high_growth, high_achievement, developing categories
- methodology: Overall approach, data sources, how scores are computed
- limitations: Comprehensive list of what this data cannot tell us
- budget_funding: Fair Student Funding (FSF), % funded, budget allocations
- suspensions: LL93 suspension data, redacted values, context
- pta_finances: PTA income, expenses, and what it reflects
- school_location: Address, building codes, NTA neighborhoods

Use when users ask "what does X mean" or need background to interpret findings.`,
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        enum: ['impact_score', 'performance_score', 'economic_need_index', 'high_growth_framework', 'categories', 'methodology', 'limitations', 'budget_funding', 'suspensions', 'pta_finances', 'school_location'],
        description: 'Topic to explain'
      }
    },
    required: ['topic']
  }
};
