import { getSchoolsByCategory, getPersistentGems, getCitywideStats, getEMSCategoryStats } from '@/lib/db/queries';
import type { SchoolWithMetrics, CuratedListType, ResponseContext } from '@/types/school';

export interface GetCuratedListsParams {
  list_type: CuratedListType;
  borough?: 'Manhattan' | 'Bronx' | 'Brooklyn' | 'Queens' | 'Staten Island';
  report_type?: 'EMS' | 'HS' | 'HST' | 'EC' | 'D75' | 'all';
  sort_by?: 'impact_score' | 'name' | 'enrollment' | 'economic_need_index';
  limit?: number;
}

export interface GetCuratedListsResult {
  list_type: CuratedListType;
  description: string;
  count: number;
  schools: SchoolWithMetrics[];
  scope: string;
  _context: ResponseContext;
}

const LIST_DESCRIPTIONS: Record<CuratedListType, string> = {
  high_growth: "Elementary/Middle Schools with strong student growth (Impact ≥ 0.55) despite lower absolute scores (Performance < 0.50), serving high-poverty populations (ENI ≥ 0.85). These schools produce exceptional learning gains that Performance Score alone would miss.",
  persistent_high_growth: "Elementary/Middle Schools that maintained strong growth status across both 2023-24 and 2024-25. Two years of consistency suggests something real, though we can't determine why.",
  high_growth_high_achievement: "Elementary/Middle Schools achieving both strong growth AND strong absolute outcomes while serving high-poverty populations. The dual success story.",
  high_achievement: "Rare cases among Elementary/Middle Schools: strong absolute scores but moderate growth. Students may arrive well-prepared.",
  all_high_impact: "All high-poverty Elementary/Middle Schools producing top-quartile student growth, regardless of absolute performance level."
};

/**
 * Retrieve pre-computed school categories and curated lists.
 *
 * IMPORTANT: The high growth analysis and four-group framework were designed
 * for Elementary/Middle Schools (EMS) only. By default, this tool returns
 * EMS schools. Other school types can be queried but should include appropriate
 * caveats about methodology applicability.
 */
export function getCuratedListsTool(params: GetCuratedListsParams): GetCuratedListsResult {
  const {
    list_type,
    borough,
    report_type = 'EMS', // Default to EMS - the scope of the original analysis
    sort_by = 'impact_score',
    limit = 20
  } = params;

  const citywideStats = getCitywideStats('2024-25');

  // Determine effective report type for queries
  const effectiveReportType = report_type === 'all' ? 'all' : report_type;

  // Map list_type to database category name
  const DB_CATEGORY: Record<string, string> = {
    high_growth: 'high_growth',
    high_achievement: 'high_achievement',
    high_growth_high_achievement: 'high_growth_high_achievement',
  };

  let schools: SchoolWithMetrics[];

  // Get the appropriate list with report_type filter
  if (list_type === 'persistent_high_growth') {
    schools = getPersistentGems(effectiveReportType);
  } else if (list_type === 'all_high_impact') {
    // Combine high_growth_high_achievement and high_growth
    const highGrowthHighAchievement = getSchoolsByCategory('high_growth_high_achievement', '2024-25', 200, effectiveReportType);
    const highGrowth = getSchoolsByCategory('high_growth', '2024-25', 200, effectiveReportType);
    schools = [...highGrowthHighAchievement, ...highGrowth];
  } else {
    const dbCategory = DB_CATEGORY[list_type] || list_type;
    schools = getSchoolsByCategory(dbCategory, '2024-25', 200, effectiveReportType);
  }

  // Apply borough filter
  if (borough) {
    schools = schools.filter(s => s.borough === borough);
  }

  // Sort
  schools.sort((a, b) => {
    const aVal = a[sort_by as keyof typeof a];
    const bVal = b[sort_by as keyof typeof b];

    if (sort_by === 'name') {
      return String(aVal || '').localeCompare(String(bVal || ''));
    }

    // Numeric sort, descending (except for ENI where lower might be preferred for some uses)
    const aNum = typeof aVal === 'number' ? aVal : 0;
    const bNum = typeof bVal === 'number' ? bVal : 0;
    return bNum - aNum;
  });

  // Apply limit
  schools = schools.slice(0, limit);

  // Build scope description
  const scopeLabel = report_type === 'all'
    ? 'All School Types'
    : report_type === 'EMS'
      ? 'Elementary/Middle Schools'
      : `${report_type} Schools`;

  const limitations: string[] = [
    'Categories computed using fixed thresholds (Impact ≥ 0.55, Performance threshold at 0.50, ENI ≥ 0.85)',
    'Cannot determine WHY schools appear in these categories',
    'Year-over-year volatility is significant'
  ];

  // Add scope caveat for non-EMS queries
  if (report_type !== 'EMS') {
    limitations.unshift(
      `SCOPE NOTE: The four-group framework was validated for Elementary/Middle Schools only. Results for ${scopeLabel} may show different patterns and should be interpreted with additional caution.`
    );
  }

  if (list_type === 'persistent_high_growth') {
    limitations.push(
      'Two years of data provides more confidence but still cannot prove causation'
    );
  }

  if (list_type === 'high_growth') {
    limitations.push(
      'Many schools in this category do not maintain status year-over-year'
    );
  }

  return {
    list_type,
    description: LIST_DESCRIPTIONS[list_type],
    count: schools.length,
    schools,
    scope: scopeLabel,
    _context: {
      sample_size: schools.length,
      data_year: '2024-25',
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72
      },
      limitations,
      methodology_note: `Categories are pre-computed during data import for ${scopeLabel}. See explain_metrics("categories") for detailed criteria.`
    }
  };
}

export const getCuratedListsDefinition = {
  name: 'get_curated_lists',
  description: `Retrieve pre-computed school categories and curated lists.

IMPORTANT SCOPE NOTE: The high growth analysis and four-group framework were
designed for and validated on Elementary/Middle Schools (EMS) only. By default,
this tool returns EMS schools. High Schools and other school types show different
patterns and require separate analysis.

Available lists:
- high_growth: Strong growth, lower-performance, high-poverty EMS schools
- persistent_high_growth: EMS schools that were high-growth in BOTH 2023-24 and 2024-25
- high_growth_high_achievement: Strong growth AND strong outcomes, high-poverty EMS schools
- high_achievement: Strong outcomes but moderate growth, high-poverty EMS schools (rare)
- all_high_impact: All high-poverty EMS schools with top-quartile student growth

Categories are pre-computed using fixed thresholds:
- High Impact: Impact Score >= 0.55
- High Performance: Performance Score >= 0.50
- High Poverty: Economic Need >= 0.85

Results include full context (both scores, ENI, enrollment) for each school.

Use this for the High Growth Schools feature page or when users ask about "schools beating the odds" or "high-growth high-poverty schools." Always clarify that results are for Elementary/Middle Schools.`,
  parameters: {
    type: 'object',
    properties: {
      list_type: {
        type: 'string',
        enum: ['high_growth', 'persistent_high_growth', 'high_growth_high_achievement', 'high_achievement', 'all_high_impact'],
        description: 'Which curated list to retrieve'
      },
      borough: {
        type: 'string',
        enum: ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'],
        description: 'Optional: filter by borough'
      },
      report_type: {
        type: 'string',
        enum: ['EMS', 'HS', 'HST', 'EC', 'D75', 'all'],
        default: 'EMS',
        description: 'School type filter. Defaults to EMS (Elementary/Middle Schools) - the scope of the original analysis. Use "all" to include all school types (with scope caveats).'
      },
      sort_by: {
        type: 'string',
        enum: ['impact_score', 'name', 'enrollment', 'economic_need_index'],
        default: 'impact_score',
        description: 'How to sort results'
      },
      limit: {
        type: 'number',
        default: 20,
        description: 'Maximum number of results'
      }
    },
    required: ['list_type']
  }
};
