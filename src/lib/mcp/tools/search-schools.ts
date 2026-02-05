import { searchSchools, countSchools, getCitywideStats } from '@/lib/db/queries';
import type { SchoolWithMetrics, ResponseContext } from '@/types/school';

export interface SearchSchoolsParams {
  query?: string;  // Search by school name or DBN (partial match)
  borough?: 'Manhattan' | 'Bronx' | 'Brooklyn' | 'Queens' | 'Staten Island';
  report_type?: 'EMS' | 'HS' | 'HST' | 'EC' | 'D75';
  min_impact_score?: number;
  max_impact_score?: number;
  min_performance_score?: number;
  max_performance_score?: number;
  min_eni?: number;
  max_eni?: number;
  min_enrollment?: number;
  max_enrollment?: number;
  category?: 'high_growth_high_achievement' | 'high_growth' | 'high_achievement';
  is_charter?: boolean;
  year?: string;
  limit?: number;
  min_pct_funded?: number;
  max_pct_funded?: number;
  council_district?: number;
  nta?: string;
  sort_by?: 'impact_score' | 'performance_score' | 'economic_need_index' | 'enrollment' | 'student_attendance' | 'teacher_attendance' | 'name';
  sort_order?: 'asc' | 'desc';
}

export interface SearchSchoolsResult {
  schools: SchoolWithMetrics[];
  total_count: number;
  _context: ResponseContext;
}

/**
 * Search NYC schools by various criteria.
 *
 * IMPORTANT USAGE GUIDANCE:
 * - Results always include Economic Need (ENI) alongside performance metrics
 * - Impact Score (student growth) is less confounded by poverty than Performance Score
 * - Never present results as a ranking of "best" or "worst" schools
 * - Always note sample size and data limitations when presenting findings
 */
export function searchSchoolsTool(params: SearchSchoolsParams): SearchSchoolsResult {
  const year = params.year || '2024-25';
  const limit = Math.min(params.limit || 10, 100);

  // Map parameters to query format
  const queryParams = {
    query: params.query,
    borough: params.borough,
    reportType: params.report_type,
    minImpactScore: params.min_impact_score,
    maxImpactScore: params.max_impact_score,
    minPerformanceScore: params.min_performance_score,
    maxPerformanceScore: params.max_performance_score,
    minEni: params.min_eni,
    maxEni: params.max_eni,
    minEnrollment: params.min_enrollment,
    maxEnrollment: params.max_enrollment,
    category: params.category,
    isCharter: params.is_charter,
    year,
    limit,
    nta: params.nta,
    councilDistrict: params.council_district,
    sortBy: params.sort_by,
    sortOrder: params.sort_order,
  };

  // Map old DB category values to new names in response
  const mapCategory = (cat: string | null): string | null => {
    if (cat === 'developing') return 'below_growth_threshold';
    if (cat === 'below_threshold') return 'lower_economic_need';
    return cat;
  };

  const rawSchools = searchSchools(queryParams);
  const schools = rawSchools.map(s => ({ ...s, category: mapCategory(s.category) as SchoolWithMetrics['category'] }));
  const totalCount = countSchools(queryParams);
  const citywideStats = getCitywideStats(year);

  // Build limitations based on query
  const limitations: string[] = [
    'Based on NYC DOE School Quality Report data',
    `Data from ${year} school year`,
  ];

  if (params.category) {
    limitations.push(
      'Categories are computed using fixed thresholds and may not capture all nuances'
    );
  }

  if (params.min_impact_score || params.max_impact_score) {
    limitations.push(
      'Impact Score methodology not fully disclosed by DOE; interpret with caution'
    );
  }

  if (schools.length < 10) {
    limitations.push(
      `Small sample size (${schools.length} schools) limits generalizability`
    );
  }

  // Add charter warning if results include charter schools
  const charterCount = schools.filter(s => s.is_charter).length;
  const districtCount = schools.length - charterCount;
  if (charterCount > 0) {
    limitations.push(
      `Results include ${charterCount} charter and ${districtCount} district schools. Charter results should be interpreted with caution due to lottery selection effects and data differences.`
    );
  }

  // Count how many schools have values for key metrics
  const metricsWithData: Record<string, number> = {
    impact_score: schools.filter(s => s.impact_score !== null && s.impact_score !== undefined).length,
    performance_score: schools.filter(s => s.performance_score !== null && s.performance_score !== undefined).length,
    economic_need_index: schools.filter(s => s.economic_need_index !== null && s.economic_need_index !== undefined).length,
    student_attendance: schools.filter(s => s.student_attendance !== null && s.student_attendance !== undefined).length,
    teacher_attendance: schools.filter(s => s.teacher_attendance !== null && s.teacher_attendance !== undefined).length,
    enrollment: schools.filter(s => s.enrollment !== null && s.enrollment !== undefined).length,
  };

  return {
    schools,
    total_count: totalCount,
    _context: {
      sample_size: schools.length,
      data_year: year,
      sort_applied: params.sort_by ? {
        field: params.sort_by,
        order: params.sort_order || 'desc',
        note: `Results are sorted by ${params.sort_by} (${params.sort_order || 'desc'}). The ${params.sort_by} value for each school is included in the school objects above.`
      } : undefined,
      metrics_available: metricsWithData,
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72
      },
      limitations,
      methodology_note: 'Impact Score measures student growth relative to similar students. Performance Score measures absolute outcomes and correlates strongly with poverty (r=-0.69).'
    }
  };
}

export const searchSchoolsDefinition = {
  name: 'search_schools',
  description: `Search NYC schools by various criteria. Returns schools with required context.

CRITICAL: Apply ALL filters the user requests:
- If user says "Brooklyn" → include borough="Brooklyn"
- If user says "elementary/middle schools" → include report_type="EMS"
- If user says "high-poverty" or "above economic need threshold" → include min_eni=0.85
- If user asks for "lowest" or "highest" → use sort_by and sort_order parameters
- Missing a user-specified filter is a serious error that returns incorrect results

SORTING: Use sort_by and sort_order when user wants ranked results:
- "lowest attendance" → sort_by="student_attendance", sort_order="asc"
- "highest impact" → sort_by="impact_score", sort_order="desc"
- Available sort fields: impact_score, performance_score, economic_need_index, enrollment, student_attendance, teacher_attendance, name

IMPORTANT USAGE GUIDANCE:
- Results always include Economic Need (ENI) alongside performance metrics
- Impact Score (student growth) is less confounded by poverty than Performance Score
- Never present results as a ranking of "best" or "worst" schools
- Always note sample size and data limitations when presenting findings

This tool always returns both Impact Score AND Performance Score together with Economic Need context to prevent misinterpretation.`,
  parameters: {
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
        description: 'Filter by school report type (EMS=Elementary/Middle, HS=High School, etc.)'
      },
      min_impact_score: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Minimum Impact Score (student growth metric, 0-1)'
      },
      max_impact_score: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Maximum Impact Score'
      },
      min_performance_score: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Minimum Performance Score (absolute outcomes, 0-1)'
      },
      max_performance_score: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Maximum Performance Score'
      },
      min_eni: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Minimum Economic Need Index (poverty indicator, 0-1, higher = more poverty)'
      },
      max_eni: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Maximum Economic Need Index'
      },
      min_enrollment: {
        type: 'number',
        description: 'Minimum student enrollment'
      },
      max_enrollment: {
        type: 'number',
        description: 'Maximum student enrollment'
      },
      category: {
        type: 'string',
        enum: ['high_growth_high_achievement', 'high_growth', 'high_achievement'],
        description: 'Filter by pre-computed category. Only positive categories (high_growth_high_achievement/high_growth/high_achievement) available for bulk search.'
      },
      is_charter: {
        type: 'boolean',
        description: 'Filter by charter school status'
      },
      year: {
        type: 'string',
        enum: ['2023-24', '2024-25'],
        default: '2024-25',
        description: 'School year for the data'
      },
      limit: {
        type: 'number',
        default: 10,
        maximum: 100,
        description: 'Maximum number of results to return'
      },
      min_pct_funded: {
        type: 'number',
        minimum: 0,
        maximum: 2,
        description: 'Minimum FSF % funded (0-1 scale, 1.0 = 100% funded)'
      },
      max_pct_funded: {
        type: 'number',
        minimum: 0,
        maximum: 2,
        description: 'Maximum FSF % funded'
      },
      council_district: {
        type: 'number',
        description: 'NYC Council district number'
      },
      nta: {
        type: 'string',
        description: 'Neighborhood Tabulation Area name (e.g., "Lower East Side")'
      },
      sort_by: {
        type: 'string',
        enum: ['impact_score', 'performance_score', 'economic_need_index', 'enrollment', 'student_attendance', 'teacher_attendance', 'name'],
        default: 'impact_score',
        description: 'Field to sort results by'
      },
      sort_order: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc',
        description: 'Sort order: "asc" for ascending (lowest first), "desc" for descending (highest first)'
      }
    }
  }
};
