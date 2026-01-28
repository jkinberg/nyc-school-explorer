import { getCorrelation, getCitywideStats, countSchools } from '@/lib/db/queries';
import type { ResponseContext } from '@/types/school';

export interface AnalyzeCorrelationsParams {
  metric1: 'impact_score' | 'performance_score' | 'economic_need_index' | 'student_attendance' | 'teacher_attendance' | 'enrollment' | 'total_budget' | 'pct_funded' | 'total_suspensions' | 'pta_income';
  metric2: 'impact_score' | 'performance_score' | 'economic_need_index' | 'student_attendance' | 'teacher_attendance' | 'enrollment' | 'total_budget' | 'pct_funded' | 'total_suspensions' | 'pta_income';
  filter?: {
    min_eni?: number;
    max_eni?: number;
    category?: string;
    borough?: string;
  };
  year?: string;
}

export interface CorrelationResult {
  correlation: number | null;
  sample_size: number;
  metric1: {
    name: string;
    mean: number | null;
  };
  metric2: {
    name: string;
    mean: number | null;
  };
  interpretation: string;
  _context: ResponseContext;
}

const METRIC_LABELS: Record<string, string> = {
  impact_score: 'Impact Score (student growth)',
  performance_score: 'Performance Score (absolute outcomes)',
  economic_need_index: 'Economic Need Index (poverty)',
  student_attendance: 'Student Attendance Rate',
  teacher_attendance: 'Teacher Attendance Rate',
  enrollment: 'School Enrollment',
  total_budget: 'Total Budget Allocation',
  pct_funded: 'FSF % Funded',
  total_suspensions: 'Total Suspensions',
  pta_income: 'PTA Total Income'
};

function interpretCorrelation(r: number): string {
  const absR = Math.abs(r);
  let strength: string;

  if (absR >= 0.7) strength = 'strong';
  else if (absR >= 0.5) strength = 'moderate';
  else if (absR >= 0.3) strength = 'weak';
  else strength = 'very weak or negligible';

  const direction = r >= 0 ? 'positive' : 'negative';

  return `${strength} ${direction} correlation (r = ${r.toFixed(2)})`;
}

/**
 * Calculate correlation between metrics across schools.
 */
export function analyzeCorrelationsTool(params: AnalyzeCorrelationsParams): CorrelationResult {
  const { metric1, metric2, filter, year = '2024-25' } = params;
  const citywideStats = getCitywideStats(year);

  // Calculate correlation
  const result = getCorrelation(metric1, metric2, {
    ...filter,
    year
  });

  const sampleSize = result?.sampleSize || countSchools({ year, ...filter });

  const limitations: string[] = [
    'Correlation does not imply causation',
    'Many confounding variables may explain the relationship',
    'Results may not generalize beyond this sample'
  ];

  if (metric1 === 'performance_score' || metric2 === 'performance_score') {
    limitations.push(
      'Performance Score correlates strongly with poverty (r = -0.69); control for ENI when interpreting'
    );
  }

  if (sampleSize < 30) {
    limitations.push(
      `Small sample size (n=${sampleSize}) limits statistical power`
    );
  }

  if (metric1 === 'total_budget' || metric2 === 'total_budget' || metric1 === 'pct_funded' || metric2 === 'pct_funded') {
    limitations.push(
      'Charter school budgets are not comparable to DOE-managed school budgets; consider filtering to non-charter schools'
    );
  }

  if (metric1 === 'total_suspensions' || metric2 === 'total_suspensions') {
    limitations.push(
      'Suspension data includes redacted values for small counts; schools with redacted data excluded from correlation'
    );
    limitations.push(
      'Suspension rates correlate with poverty and systemic bias; interpret with ENI context'
    );
  }

  if (metric1 === 'pta_income' || metric2 === 'pta_income') {
    limitations.push(
      'PTA income primarily reflects parent wealth, not school quality or effectiveness'
    );
  }

  let interpretation = 'Unable to calculate correlation';
  if (result?.correlation !== null && result?.correlation !== undefined) {
    interpretation = interpretCorrelation(result.correlation);
  }

  return {
    correlation: result?.correlation ?? null,
    sample_size: sampleSize,
    metric1: {
      name: METRIC_LABELS[metric1] || metric1,
      mean: result?.metric1Mean ?? null
    },
    metric2: {
      name: METRIC_LABELS[metric2] || metric2,
      mean: result?.metric2Mean ?? null
    },
    interpretation,
    _context: {
      sample_size: sampleSize,
      data_year: year,
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72
      },
      limitations,
      methodology_note: 'Pearson correlation coefficient calculated across all schools matching the filter criteria. Always consider alternative explanations for observed patterns.'
    }
  };
}

export const analyzeCorrelationsDefinition = {
  name: 'analyze_correlations',
  description: `Calculate correlation between metrics across schools.

IMPORTANT: Correlation does not imply causation. Results should always be presented with:
- The correlation coefficient and what it means
- Sample size
- Acknowledgment that other factors may explain the relationship
- Competing hypotheses for any pattern observed

Common analyses:
- Impact Score vs. Attendance
- Performance Score vs. Economic Need
- Impact Score vs. Teacher Experience

Returns statistical results with required interpretive context.`,
  parameters: {
    type: 'object',
    properties: {
      metric1: {
        type: 'string',
        enum: ['impact_score', 'performance_score', 'economic_need_index', 'student_attendance', 'teacher_attendance', 'enrollment', 'total_budget', 'pct_funded', 'total_suspensions', 'pta_income'],
        description: 'First metric to correlate'
      },
      metric2: {
        type: 'string',
        enum: ['impact_score', 'performance_score', 'economic_need_index', 'student_attendance', 'teacher_attendance', 'enrollment', 'total_budget', 'pct_funded', 'total_suspensions', 'pta_income'],
        description: 'Second metric to correlate'
      },
      filter: {
        type: 'object',
        properties: {
          min_eni: { type: 'number', description: 'Minimum Economic Need Index' },
          max_eni: { type: 'number', description: 'Maximum Economic Need Index' },
          category: { type: 'string', description: 'Filter by school category' },
          borough: { type: 'string', description: 'Filter by borough' }
        },
        description: 'Optional filters to apply'
      },
      year: {
        type: 'string',
        enum: ['2023-24', '2024-25'],
        default: '2024-25',
        description: 'School year for the data'
      }
    },
    required: ['metric1', 'metric2']
  }
};
