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
  hidden_gems: "Elementary/Middle Schools with high student growth (Impact ≥ 0.60) despite lower absolute scores (Performance < 0.50), serving high-poverty populations (ENI ≥ 0.85). These schools produce exceptional learning gains that Performance Score alone would miss.",
  persistent_gems: "Elementary/Middle Schools that maintained Hidden Gem or Elite status across both 2023-24 and 2024-25. Two years of consistency suggests something real, though we can't determine why.",
  elite: "Elementary/Middle Schools achieving both high growth AND high absolute outcomes while serving high-poverty populations. The dual success story.",
  anomalies: "Rare cases among Elementary/Middle Schools: high absolute scores but lower growth. Students may arrive well-prepared.",
  all_high_impact: "All high-poverty Elementary/Middle Schools producing top-quartile student growth, regardless of absolute performance level."
};

/**
 * Retrieve pre-computed school categories and curated lists.
 *
 * IMPORTANT: The Hidden Gems analysis and four-group framework were designed
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
    limit = 50
  } = params;

  const citywideStats = getCitywideStats('2024-25');

  // Determine effective report type for queries
  const effectiveReportType = report_type === 'all' ? 'all' : report_type;

  let schools: SchoolWithMetrics[];

  // Get the appropriate list with report_type filter
  if (list_type === 'persistent_gems') {
    schools = getPersistentGems(effectiveReportType);
  } else if (list_type === 'all_high_impact') {
    // Combine elite and hidden_gem
    const elite = getSchoolsByCategory('elite', '2024-25', 200, effectiveReportType);
    const gems = getSchoolsByCategory('hidden_gem', '2024-25', 200, effectiveReportType);
    schools = [...elite, ...gems];
  } else {
    schools = getSchoolsByCategory(list_type, '2024-25', 200, effectiveReportType);
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
    'Categories computed using fixed thresholds (Impact ≥ 0.60, Performance threshold at 0.50, ENI ≥ 0.85)',
    'Cannot determine WHY schools appear in these categories',
    'Year-over-year volatility is significant'
  ];

  // Add scope caveat for non-EMS queries
  if (report_type !== 'EMS') {
    limitations.unshift(
      `SCOPE NOTE: The four-group framework was validated for Elementary/Middle Schools only. Results for ${scopeLabel} may show different patterns and should be interpreted with additional caution.`
    );
  }

  if (list_type === 'persistent_gems') {
    limitations.push(
      'Two years of data provides more confidence but still cannot prove causation'
    );
  }

  if (list_type === 'hidden_gems') {
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

IMPORTANT SCOPE NOTE: The Hidden Gems analysis and four-group framework were
designed for and validated on Elementary/Middle Schools (EMS) only. By default,
this tool returns EMS schools. High Schools and other school types show different
patterns and require separate analysis.

Available lists:
- hidden_gems: High-impact, lower-performance, high-poverty EMS schools
- persistent_gems: EMS schools that were high-impact in BOTH 2023-24 and 2024-25
- elite: High-impact AND high-performance, high-poverty EMS schools
- anomalies: High-performance but lower-impact, high-poverty EMS schools (rare)
- all_high_impact: All high-poverty EMS schools with top-quartile student growth

Categories are pre-computed using fixed thresholds:
- High Impact: Impact Score >= 0.60
- High Performance: Performance Score >= 0.50
- High Poverty: Economic Need >= 0.85

Results include full context (both scores, ENI, enrollment) for each school.

Use this for the Hidden Gems feature page or when users ask about "schools beating the odds" or "high-growth high-poverty schools." Always clarify that results are for Elementary/Middle Schools.`,
  parameters: {
    type: 'object',
    properties: {
      list_type: {
        type: 'string',
        enum: ['hidden_gems', 'persistent_gems', 'elite', 'anomalies', 'all_high_impact'],
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
        default: 50,
        description: 'Maximum number of results'
      }
    },
    required: ['list_type']
  }
};
