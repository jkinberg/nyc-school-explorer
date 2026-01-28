import { searchSchools, getCitywideStats } from '@/lib/db/queries';
import type { ChartData } from '@/types/chat';
import type { ResponseContext } from '@/types/school';

export interface GenerateChartParams {
  chart_type: 'scatter' | 'bar' | 'histogram';
  x_metric: string;
  y_metric?: string; // Required for scatter plots
  color_by?: 'category' | 'borough' | 'is_charter';
  filter?: {
    borough?: string;
    min_eni?: number;
    max_eni?: number;
    category?: string;
    report_type?: string;
  };
  title?: string;
  year?: string;
  limit?: number;
}

export interface GenerateChartResult {
  chart: ChartData;
  _context: ResponseContext;
}

const METRIC_LABELS: Record<string, string> = {
  impact_score: 'Impact Score',
  performance_score: 'Performance Score',
  economic_need_index: 'Economic Need Index',
  student_attendance: 'Student Attendance Rate',
  teacher_attendance: 'Teacher Attendance Rate',
  enrollment: 'Enrollment'
};

/**
 * Generate data for visualization (scatter plot, bar chart, histogram).
 */
export function generateChartTool(params: GenerateChartParams): GenerateChartResult {
  const {
    chart_type,
    x_metric,
    y_metric,
    color_by,
    filter,
    title,
    year = '2024-25',
    limit = 500
  } = params;

  const citywideStats = getCitywideStats(year);

  // Get data
  const schools = searchSchools({
    borough: filter?.borough,
    minEni: filter?.min_eni,
    maxEni: filter?.max_eni,
    category: filter?.category,
    reportType: filter?.report_type,
    year,
    limit
  });

  // Transform data for chart
  const chartData = schools
    .filter(s => {
      const xVal = s[x_metric as keyof typeof s];
      if (chart_type === 'scatter' && y_metric) {
        const yVal = s[y_metric as keyof typeof s];
        return xVal !== null && yVal !== null;
      }
      return xVal !== null;
    })
    .map(s => {
      const point: Record<string, unknown> = {
        name: s.name,
        dbn: s.dbn,
        [x_metric]: s[x_metric as keyof typeof s]
      };

      if (y_metric) {
        point[y_metric] = s[y_metric as keyof typeof s];
      }

      if (color_by) {
        point[color_by] = s[color_by as keyof typeof s];
      }

      // Always include context
      point.economic_need_index = s.economic_need_index;
      point.impact_score = s.impact_score;
      point.performance_score = s.performance_score;

      return point;
    });

  // Generate default title
  const defaultTitle = chart_type === 'scatter'
    ? `${METRIC_LABELS[x_metric] || x_metric} vs ${METRIC_LABELS[y_metric || ''] || y_metric}`
    : `Distribution of ${METRIC_LABELS[x_metric] || x_metric}`;

  const limitations: string[] = [
    'Chart shows patterns but cannot prove causation',
    `Based on ${chartData.length} schools with available data`
  ];

  if (chart_type === 'scatter' && x_metric === 'performance_score') {
    limitations.push(
      'Performance Score correlates with poverty; interpret patterns carefully'
    );
  }

  if (chartData.length === limit) {
    limitations.push(
      `Results limited to ${limit} schools; may not show complete picture`
    );
  }

  return {
    chart: {
      type: chart_type,
      title: title || defaultTitle,
      xAxis: {
        label: METRIC_LABELS[x_metric] || x_metric,
        dataKey: x_metric
      },
      yAxis: {
        label: y_metric ? (METRIC_LABELS[y_metric] || y_metric) : 'Count',
        dataKey: y_metric || 'count'
      },
      data: chartData,
      colorBy: color_by,
      context: {
        sample_size: chartData.length,
        data_year: year,
        citywide_medians: {
          impact: citywideStats?.median_impact_score || 0.50,
          performance: citywideStats?.median_performance_score || 0.50,
          eni: citywideStats?.median_economic_need || 0.72
        },
        limitations
      }
    },
    _context: {
      sample_size: chartData.length,
      data_year: year,
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72
      },
      limitations,
      methodology_note: 'Charts should be interpreted with context. Patterns may have multiple explanations.'
    }
  };
}

export const generateChartDefinition = {
  name: 'generate_chart',
  description: `Generate data for visualization (scatter plot, bar chart, histogram).

Charts should always:
- Include axis labels with metric names
- Note sample size
- Avoid implying rankings unless explicitly comparing on a single dimension
- Include trend lines only with appropriate caveats about interpretation

Returns structured data for client-side rendering with Recharts, not images.`,
  parameters: {
    type: 'object',
    properties: {
      chart_type: {
        type: 'string',
        enum: ['scatter', 'bar', 'histogram'],
        description: 'Type of chart to generate'
      },
      x_metric: {
        type: 'string',
        description: 'Metric for x-axis (e.g., impact_score, economic_need_index)'
      },
      y_metric: {
        type: 'string',
        description: 'Metric for y-axis (required for scatter plots)'
      },
      color_by: {
        type: 'string',
        enum: ['category', 'borough', 'is_charter'],
        description: 'Optional: color points/bars by this field'
      },
      filter: {
        type: 'object',
        properties: {
          borough: { type: 'string' },
          min_eni: { type: 'number' },
          max_eni: { type: 'number' },
          category: { type: 'string' },
          report_type: { type: 'string' }
        },
        description: 'Optional filters to apply'
      },
      title: {
        type: 'string',
        description: 'Custom chart title'
      },
      year: {
        type: 'string',
        enum: ['2023-24', '2024-25'],
        default: '2024-25'
      },
      limit: {
        type: 'number',
        default: 500,
        maximum: 1000,
        description: 'Maximum data points'
      }
    },
    required: ['chart_type', 'x_metric']
  }
};
