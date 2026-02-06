import { searchSchools, getCitywideStats } from '@/lib/db/queries';
import type { ChartData } from '@/types/chat';
import type { ResponseContext } from '@/types/school';

export interface GenerateChartParams {
  chart_type: 'scatter' | 'bar' | 'histogram' | 'yoy_change' | 'diverging_bar';
  x_metric: string;
  y_metric?: string; // Required for scatter plots
  color_by?: 'category' | 'borough' | 'is_charter';
  filter?: {
    borough?: string;
    min_eni?: number;
    max_eni?: number;
    category?: string;
    report_type?: string;
    is_charter?: boolean;
  };
  title?: string;
  year?: string;
  limit?: number;
  midpoint?: number;     // Threshold for diverging_bar (default: metric-specific or citywide mean)
  show_change?: boolean; // If true, calculate YoY change (diverging_bar only, midpoint defaults to 0)
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
 * Bin data for histogram display.
 * Creates bins with counts, optionally grouped by a category field.
 */
function binDataForHistogram(
  data: Record<string, unknown>[],
  metricKey: string,
  colorBy?: string,
  numBins: number = 10
): { bins: Record<string, unknown>[]; min: number; max: number; binWidth: number } {
  // Extract metric values
  const values = data
    .map(d => d[metricKey] as number)
    .filter(v => v !== null && v !== undefined && !isNaN(v));

  if (values.length === 0) {
    return { bins: [], min: 0, max: 1, binWidth: 0.1 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / numBins || 0.1;

  // Initialize bins
  const binCounts: Record<string, Record<string, number>> = {};
  for (let i = 0; i < numBins; i++) {
    const binStart = min + i * binWidth;
    const binLabel = `${binStart.toFixed(2)}-${(binStart + binWidth).toFixed(2)}`;
    binCounts[binLabel] = { total: 0 };
  }

  // Count items in each bin
  for (const item of data) {
    const value = item[metricKey] as number;
    if (value === null || value === undefined || isNaN(value)) continue;

    // Find which bin this value belongs to
    let binIndex = Math.floor((value - min) / binWidth);
    // Handle edge case where value equals max
    if (binIndex >= numBins) binIndex = numBins - 1;
    if (binIndex < 0) binIndex = 0;

    const binStart = min + binIndex * binWidth;
    const binLabel = `${binStart.toFixed(2)}-${(binStart + binWidth).toFixed(2)}`;

    if (!binCounts[binLabel]) {
      binCounts[binLabel] = { total: 0 };
    }

    binCounts[binLabel].total++;

    // Also count by category if colorBy is specified
    if (colorBy) {
      const category = String(item[colorBy] || 'unknown');
      binCounts[binLabel][category] = (binCounts[binLabel][category] || 0) + 1;
    }
  }

  // Convert to array format for chart
  const bins = Object.entries(binCounts).map(([label, counts]) => ({
    bin: label,
    count: counts.total,
    ...counts
  }));

  // Sort by bin label (which is numeric)
  bins.sort((a, b) => {
    const aStart = parseFloat(String(a.bin).split('-')[0]);
    const bStart = parseFloat(String(b.bin).split('-')[0]);
    return aStart - bStart;
  });

  return { bins, min, max, binWidth };
}

/**
 * Generate year-over-year change chart data.
 */
function generateYoYChart(params: GenerateChartParams): GenerateChartResult {
  const { x_metric, color_by, filter, title, limit = 200 } = params;

  // Get data from both years
  const schools2324 = searchSchools({
    borough: filter?.borough,
    minEni: filter?.min_eni,
    maxEni: filter?.max_eni,
    category: filter?.category,
    reportType: filter?.report_type,
    year: '2023-24',
    limit: 1000
  });

  const schools2425 = searchSchools({
    borough: filter?.borough,
    minEni: filter?.min_eni,
    maxEni: filter?.max_eni,
    category: filter?.category,
    reportType: filter?.report_type,
    year: '2024-25',
    limit: 1000
  });

  // Create lookup for 2023-24 data
  const data2324Map = new Map(schools2324.map(s => [s.dbn, s]));

  // Calculate changes for schools present in both years
  const chartData: Record<string, unknown>[] = [];
  for (const school of schools2425) {
    const prev = data2324Map.get(school.dbn);
    if (!prev) continue;

    const currentVal = school[x_metric as keyof typeof school] as number | null;
    const prevVal = prev[x_metric as keyof typeof prev] as number | null;

    if (currentVal === null || prevVal === null) continue;

    const change = currentVal - prevVal;

    const point: Record<string, unknown> = {
      name: school.name,
      dbn: school.dbn,
      [`${x_metric}_2324`]: prevVal,
      [`${x_metric}_2425`]: currentVal,
      [`${x_metric}_change`]: change,
      economic_need_index: school.economic_need_index,
      impact_score: school.impact_score,
      performance_score: school.performance_score
    };

    if (color_by) {
      point[color_by] = school[color_by as keyof typeof school];
    }

    chartData.push(point);
  }

  // Sort by change and limit
  chartData.sort((a, b) => Math.abs(b[`${x_metric}_change`] as number) - Math.abs(a[`${x_metric}_change`] as number));
  const limitedData = chartData.slice(0, limit);

  const citywideStats = getCitywideStats('2024-25');
  const metricLabel = METRIC_LABELS[x_metric] || x_metric;

  const limitations: string[] = [
    'Year-over-year changes may reflect cohort differences, not school improvement',
    `Based on ${limitedData.length} schools with data in both years`,
    'Only 2 years of Impact Score data available (2023-24, 2024-25)'
  ];

  return {
    chart: {
      type: 'scatter',
      title: title || `Year-over-Year Change in ${metricLabel}`,
      xAxis: {
        label: `${metricLabel} (2023-24)`,
        dataKey: `${x_metric}_2324`
      },
      yAxis: {
        label: `${metricLabel} (2024-25)`,
        dataKey: `${x_metric}_2425`
      },
      data: limitedData,
      colorBy: color_by,
      context: {
        sample_size: limitedData.length,
        data_year: '2023-24 vs 2024-25',
        citywide_medians: {
          impact: citywideStats?.median_impact_score || 0.50,
          performance: citywideStats?.median_performance_score || 0.50,
          eni: citywideStats?.median_economic_need || 0.72
        },
        limitations
      }
    },
    _context: {
      sample_size: limitedData.length,
      data_year: '2023-24 vs 2024-25',
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72
      },
      limitations,
      methodology_note: 'Year-over-year changes should be interpreted cautiously. Schools above the diagonal improved; schools below declined.'
    }
  };
}

// Default midpoints by metric for diverging bar charts
const DEFAULT_MIDPOINTS: Record<string, number> = {
  impact_score: 0.50,
  performance_score: 0.49,
  student_attendance: 0.90,
  teacher_attendance: 0.95,
};

/**
 * Generate diverging bar chart data showing values above/below a threshold.
 * Ideal for Impact Score (midpoint = 0.50) and year-over-year changes (midpoint = 0).
 */
function generateDivergingBarChart(params: GenerateChartParams): GenerateChartResult {
  const { x_metric, filter, title, limit = 30, show_change, midpoint: customMidpoint } = params;

  const citywideStats = getCitywideStats('2024-25');

  // Determine the threshold (midpoint)
  let threshold: number;
  if (show_change) {
    // For year-over-year change, midpoint is always 0
    threshold = customMidpoint ?? 0;
  } else if (customMidpoint !== undefined) {
    threshold = customMidpoint;
  } else if (DEFAULT_MIDPOINTS[x_metric] !== undefined) {
    threshold = DEFAULT_MIDPOINTS[x_metric];
  } else {
    // Fall back to citywide mean for the metric
    const means: Record<string, number> = {
      impact_score: citywideStats?.median_impact_score || 0.50,
      performance_score: citywideStats?.median_performance_score || 0.49,
      economic_need_index: citywideStats?.median_economic_need || 0.72,
    };
    threshold = means[x_metric] ?? 0.50;
  }

  const metricLabel = METRIC_LABELS[x_metric] || x_metric;
  let chartData: Record<string, unknown>[] = [];
  const limitations: string[] = [];

  if (show_change) {
    // Fetch both years and calculate change
    const schools2324 = searchSchools({
      borough: filter?.borough,
      minEni: filter?.min_eni,
      maxEni: filter?.max_eni,
      category: filter?.category,
      reportType: filter?.report_type,
      isCharter: filter?.is_charter,
      year: '2023-24',
      limit: 1000
    });

    const schools2425 = searchSchools({
      borough: filter?.borough,
      minEni: filter?.min_eni,
      maxEni: filter?.max_eni,
      category: filter?.category,
      reportType: filter?.report_type,
      isCharter: filter?.is_charter,
      year: '2024-25',
      limit: 1000
    });

    // Create lookup for 2023-24 data
    const data2324Map = new Map(schools2324.map(s => [s.dbn, s]));

    // Calculate changes for schools present in both years
    for (const school of schools2425) {
      const prev = data2324Map.get(school.dbn);
      if (!prev) continue;

      const currentVal = school[x_metric as keyof typeof school] as number | null;
      const prevVal = prev[x_metric as keyof typeof prev] as number | null;

      if (currentVal === null || prevVal === null) continue;

      const change = currentVal - prevVal;
      const deviation = change - threshold; // For show_change with threshold=0, deviation equals change

      chartData.push({
        name: school.name,
        dbn: school.dbn,
        value: change, // The change value
        deviation: deviation,
        isPositive: deviation > 0,
        value_2324: prevVal,
        value_2425: currentVal,
        borough: school.borough,
        economic_need_index: school.economic_need_index,
        category: school.category,
      });
    }

    limitations.push(
      `Shows schools present in both 2023-24 and 2024-25 (${chartData.length} matched)`,
      'Year-over-year changes may reflect cohort differences, not school improvement',
      'Only 2 years of Impact Score data available'
    );
  } else {
    // Current year deviation from threshold
    const schools = searchSchools({
      borough: filter?.borough,
      minEni: filter?.min_eni,
      maxEni: filter?.max_eni,
      category: filter?.category,
      reportType: filter?.report_type,
      isCharter: filter?.is_charter,
      year: '2024-25',
      limit: 1000
    });

    for (const school of schools) {
      const value = school[x_metric as keyof typeof school] as number | null;
      if (value === null) continue;

      const deviation = value - threshold;

      chartData.push({
        name: school.name,
        dbn: school.dbn,
        value: value,
        deviation: deviation,
        isPositive: deviation > 0,
        borough: school.borough,
        economic_need_index: school.economic_need_index,
        impact_score: school.impact_score,
        performance_score: school.performance_score,
        category: school.category,
      });
    }

    limitations.push(
      `Based on ${chartData.length} schools with available data`,
      `Threshold set at ${threshold.toFixed(2)} for ${metricLabel}`
    );
  }

  // Sort by absolute deviation (largest first) and limit
  chartData.sort((a, b) => Math.abs(b.deviation as number) - Math.abs(a.deviation as number));
  const limitedData = chartData.slice(0, limit);

  // Generate title
  const chartTitle = show_change
    ? title || `Year-over-Year Change in ${metricLabel}`
    : title || `${metricLabel} vs Threshold (${threshold.toFixed(2)})`;

  // Handle empty data
  if (limitedData.length === 0) {
    const errorContext = {
      sample_size: 0,
      data_year: show_change ? '2023-24 vs 2024-25' : '2024-25',
      error: "NO_DATA_MATCHED",
      error_message: "No schools matched the specified filter criteria.",
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72
      },
      limitations: ["No schools matched the specified filter criteria"]
    };

    return {
      chart: {
        type: 'diverging_bar',
        title: chartTitle,
        xAxis: { label: 'School', dataKey: 'name' },
        yAxis: { label: 'Deviation', dataKey: 'deviation' },
        data: [],
        midpoint: threshold,
        context: errorContext
      },
      _context: errorContext
    };
  }

  return {
    chart: {
      type: 'diverging_bar',
      title: chartTitle,
      xAxis: { label: 'School', dataKey: 'name' },
      yAxis: {
        label: show_change ? `Change in ${metricLabel}` : `Deviation from ${threshold.toFixed(2)}`,
        dataKey: 'deviation'
      },
      data: limitedData,
      midpoint: threshold,
      context: {
        sample_size: limitedData.length,
        data_year: show_change ? '2023-24 vs 2024-25' : '2024-25',
        citywide_medians: {
          impact: citywideStats?.median_impact_score || 0.50,
          performance: citywideStats?.median_performance_score || 0.50,
          eni: citywideStats?.median_economic_need || 0.72
        },
        limitations
      }
    },
    _context: {
      sample_size: limitedData.length,
      data_year: show_change ? '2023-24 vs 2024-25' : '2024-25',
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72
      },
      limitations,
      methodology_note: show_change
        ? 'Positive values indicate improvement; negative values indicate decline. Bars are sorted by magnitude of change.'
        : `Values shown as deviation from threshold (${threshold.toFixed(2)}). Positive = above threshold, negative = below.`
    }
  };
}

/**
 * Generate data for visualization (scatter plot, bar chart, histogram, year-over-year change, diverging bar).
 */
export function generateChartTool(params: GenerateChartParams): GenerateChartResult {
  // Handle year-over-year chart type separately
  if (params.chart_type === 'yoy_change') {
    return generateYoYChart(params);
  }

  // Handle diverging bar chart type
  if (params.chart_type === 'diverging_bar') {
    return generateDivergingBarChart(params);
  }

  const {
    chart_type,
    x_metric,
    y_metric,
    color_by,
    filter,
    title,
    year = '2024-25',
    limit = 200
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

  // Handle empty data case - return explicit error context
  if (chartData.length === 0) {
    const defaultTitle = chart_type === 'scatter'
      ? `${METRIC_LABELS[x_metric] || x_metric} vs ${METRIC_LABELS[y_metric || ''] || y_metric}`
      : `Distribution of ${METRIC_LABELS[x_metric] || x_metric}`;

    const errorContext = {
      sample_size: 0,
      data_year: year,
      error: "NO_DATA_MATCHED",
      error_message: "No schools matched the specified filter criteria. The chart cannot be rendered. Suggest broadening filters or checking criteria.",
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72
      },
      limitations: [
        "No schools matched the specified filter criteria",
        "Try broadening filters or checking criteria values"
      ]
    };

    return {
      chart: {
        type: chart_type,
        title: title || defaultTitle,
        xAxis: { label: METRIC_LABELS[x_metric] || x_metric, dataKey: x_metric },
        yAxis: { label: y_metric ? (METRIC_LABELS[y_metric] || y_metric) : 'Count', dataKey: y_metric || 'count' },
        data: [],
        colorBy: color_by,
        context: errorContext
      },
      _context: errorContext
    };
  }

  // Handle histogram specially - need to bin the data
  if (chart_type === 'histogram') {
    const { bins, min, max } = binDataForHistogram(chartData, x_metric, color_by);

    const limitations: string[] = [
      'Histogram shows distribution patterns but cannot prove causation',
      `Based on ${chartData.length} schools with available data`,
      `Values range from ${min.toFixed(2)} to ${max.toFixed(2)}`
    ];

    if (x_metric === 'performance_score') {
      limitations.push('Performance Score correlates with poverty; interpret patterns carefully');
    }

    return {
      chart: {
        type: 'bar', // Histograms render as bar charts with binned data
        title: title || `Distribution of ${METRIC_LABELS[x_metric] || x_metric}`,
        xAxis: {
          label: METRIC_LABELS[x_metric] || x_metric,
          dataKey: 'bin'
        },
        yAxis: {
          label: 'Count',
          dataKey: 'count'
        },
        data: bins,
        colorBy: color_by,
        context: {
          sample_size: chartData.length,
          data_year: year,
          value_range: { min, max },
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
        value_range: { min, max },
        citywide_medians: {
          impact: citywideStats?.median_impact_score || 0.50,
          performance: citywideStats?.median_performance_score || 0.50,
          eni: citywideStats?.median_economic_need || 0.72
        },
        limitations,
        methodology_note: 'Histogram shows how values are distributed. Taller bars indicate more schools in that range.'
      }
    };
  }

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
  description: `Generate data for visualization (scatter plot, bar chart, histogram, diverging bar).

CRITICAL FILTER REQUIREMENTS:
1. ALWAYS apply ALL filters the user specifies (borough, school type, ENI thresholds, etc.)
2. When charting school categories, ALWAYS filter to report_type="EMS"
3. When user says "exclude schools below economic need threshold" or similar, use min_eni=0.85
4. When user says "elementary and middle schools", use report_type="EMS"
5. When user specifies a borough, ALWAYS include it in the filter object

Example: For "Brooklyn elementary schools with ENI above 0.85":
filter: { borough: "Brooklyn", report_type: "EMS", min_eni: 0.85 }

CHART TYPE SELECTION:
- diverging_bar: Use when comparing to a threshold/expected value. Ideal for "above or below expected", "exceed or fall short", "improved or declined" queries.
- diverging_bar + show_change=true: Use for year-over-year change visualization (midpoint defaults to 0).
- scatter: Use for correlation/relationship exploration between two metrics.
- histogram: Use for distribution analysis of a single metric.
- yoy_change: Use for detailed year-over-year comparison (scatter plot format).

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
        enum: ['scatter', 'bar', 'histogram', 'yoy_change', 'diverging_bar'],
        description: 'Type of chart. Use "diverging_bar" to show values above/below a threshold (ideal for Impact Score vs 0.50 or year-over-year changes). Use "yoy_change" for scatter plot of year-over-year comparison.'
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
          borough: {
            type: 'string',
            enum: ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'],
            description: 'Filter by borough'
          },
          min_eni: { type: 'number', description: 'Minimum Economic Need Index (0-1)' },
          max_eni: { type: 'number', description: 'Maximum Economic Need Index (0-1)' },
          category: {
            type: 'string',
            enum: ['high_growth', 'high_growth_high_achievement', 'high_achievement', 'developing', 'below_threshold'],
            description: 'Filter by school category'
          },
          report_type: {
            type: 'string',
            enum: ['EMS', 'HS', 'HST', 'D75', 'EC'],
            description: 'Filter by report type. EMS = Elementary/Middle Schools (recommended for category analysis), HS = High Schools, HST = High School Transfer, D75 = District 75, EC = Early Childhood'
          },
          is_charter: {
            type: 'boolean',
            description: 'Filter by charter status (true for charter schools, false for traditional public)'
          }
        },
        description: 'Filters to apply. IMPORTANT: For category-based analysis (high_growth, etc.), always filter to report_type="EMS" since the category framework was validated for Elementary/Middle Schools only.'
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
        default: 200,
        maximum: 1000,
        description: 'Maximum data points (default 200, max 1000; diverging_bar defaults to 30)'
      },
      midpoint: {
        type: 'number',
        description: 'Threshold for diverging_bar chart. Defaults: 0.50 for Impact Score, 0.49 for Performance Score, 0.90 for student attendance, 0 for year-over-year changes.'
      },
      show_change: {
        type: 'boolean',
        description: 'For diverging_bar only: calculate year-over-year change instead of deviation from threshold. Midpoint defaults to 0 when true.'
      }
    },
    required: ['chart_type', 'x_metric']
  }
};
