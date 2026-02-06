import {
  searchSchools,
  getCitywideStats,
  getSchoolByDBN,
  getLatestMetrics,
  getMetricsByDBN,
  findSimilarSchools,
  findSchoolsByNameOrDBN,
  getBudgetsByDBN,
  getSuspensionsByDBN,
  getPTAByDBN,
} from '@/lib/db/queries';
import type { SchoolWithMetrics, ResponseContext } from '@/types/school';

// ============================================================================
// Types
// ============================================================================

export interface CompareSchoolsParams {
  // Option 1: Compare specific schools by DBN or name
  dbns?: string[];

  // Option 2: Compare to citywide averages
  compare_to_citywide?: boolean;

  // Option 3: Compare to similar peers (uses find_similar_schools logic)
  compare_to_similar?: boolean;

  // Optional: Specify which metrics to include (default: core + attendance + category)
  metrics?: MetricName[];

  // Optional: Include year-over-year change column
  include_trends?: boolean;

  // For filtered comparisons (e.g., "top 5 Brooklyn schools")
  filter?: {
    borough?: 'Manhattan' | 'Bronx' | 'Brooklyn' | 'Queens' | 'Staten Island';
    report_type?: 'EMS' | 'HS' | 'HST' | 'D75' | 'EC';
    category?: 'high_growth' | 'high_growth_high_achievement' | 'high_achievement' | 'below_growth_threshold' | 'lower_economic_need';
    min_eni?: number;
  };

  // Max schools when using filter (default: 5)
  limit?: number;
}

// Available metrics for comparison
export type MetricName =
  // Core metrics (default)
  | 'impact_score'
  | 'performance_score'
  | 'economic_need_index'
  | 'enrollment'
  // Attendance (default)
  | 'student_attendance'
  | 'teacher_attendance'
  // Staff (optional)
  | 'principal_years'
  | 'pct_teachers_3plus_years'
  // Budget (optional)
  | 'total_budget'
  | 'pct_funded'
  // PTA (optional)
  | 'pta_income'
  // Suspensions (optional)
  | 'total_suspensions'
  // Survey scores (optional)
  | 'survey_family_involvement'
  | 'survey_family_trust'
  | 'survey_safety'
  | 'survey_communication'
  | 'survey_instruction'
  | 'survey_leadership'
  | 'survey_support'
  // Ratings (optional, string values)
  | 'rating_instruction'
  | 'rating_safety'
  | 'rating_families'
  // Category (optional)
  | 'category';

// Default metrics included in comparison
const DEFAULT_METRICS: MetricName[] = [
  'impact_score',
  'performance_score',
  'economic_need_index',
  'enrollment',
  'student_attendance',
  'teacher_attendance',
  'category',
];

export interface SchoolComparisonRow {
  // Identity
  dbn: string;
  name: string;
  borough: string;
  is_charter: boolean;

  // Core metrics (always included)
  impact_score: number | null;
  performance_score: number | null;
  economic_need_index: number | null;
  enrollment: number | null;
  category: string | null;

  // Attendance (included by default)
  student_attendance?: number | null;
  teacher_attendance?: number | null;

  // Staff metrics (optional)
  principal_years?: number | null;
  pct_teachers_3plus_years?: number | null;

  // Survey scores (optional, 0-1 scale)
  survey_family_involvement?: number | null;
  survey_family_trust?: number | null;
  survey_safety?: number | null;
  survey_communication?: number | null;
  survey_instruction?: number | null;
  survey_leadership?: number | null;
  survey_support?: number | null;

  // Ratings (optional, string values)
  rating_instruction?: string | null;
  rating_safety?: string | null;
  rating_families?: string | null;

  // Budget (optional, from school_budgets table)
  total_budget?: number | null;
  pct_funded?: number | null;

  // PTA (optional, from pta_data table)
  pta_income?: number | null;

  // Suspensions (optional, from school_suspensions table)
  total_suspensions?: number | null;

  // Trend data (when include_trends=true)
  impact_score_change?: number | null;
  performance_score_change?: number | null;
}

export type ComparisonType = 'specific' | 'vs_citywide' | 'vs_similar' | 'filtered';

export interface CompareSchoolsResult {
  comparison: {
    schools: SchoolComparisonRow[];
    metrics_included: MetricName[];
    comparison_type: ComparisonType;
    include_citywide_column: boolean;
  };
  _context: ResponseContext;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map old DB category values to user-friendly names
 */
function mapCategory(cat: string | null): string | null {
  if (cat === 'developing') return 'below_growth_threshold';
  if (cat === 'below_threshold') return 'lower_economic_need';
  return cat;
}

/**
 * Resolve school identifiers (DBNs or names) to DBNs
 */
function resolveSchoolIdentifiers(identifiers: string[]): string[] {
  return identifiers.map(id => {
    // If it looks like a DBN (e.g., "01M188", "13K123"), verify it exists
    if (/^\d{2}[A-Z]\d{3}$/i.test(id)) {
      const dbn = id.toUpperCase();
      // Verify the DBN exists in the database
      const school = getSchoolByDBN(dbn);
      if (school) {
        return dbn;
      }
      // DBN doesn't exist - fall through to fuzzy search
    }
    // Search by name (or as fallback for invalid DBNs)
    const matches = findSchoolsByNameOrDBN(id, 1);
    if (matches.length > 0) {
      return matches[0].dbn;
    }
    return null;
  }).filter((dbn): dbn is string => dbn !== null);
}

/**
 * Build a comparison row for a school
 */
function buildComparisonRow(
  school: SchoolWithMetrics,
  includeTrends: boolean,
  requestedMetrics: MetricName[]
): SchoolComparisonRow {
  // Get previous year metrics for trend calculation
  let previousMetrics: { impact_score: number | null; performance_score: number | null } | null = null;
  if (includeTrends) {
    const allMetrics = getMetricsByDBN(school.dbn, '2023-24');
    if (allMetrics.length > 0) {
      previousMetrics = {
        impact_score: allMetrics[0].impact_score,
        performance_score: allMetrics[0].performance_score,
      };
    }
  }

  // Get additional data from related tables if requested
  let budgetData: { total_budget: number | null; pct_funded: number | null } | null = null;
  if (requestedMetrics.includes('total_budget') || requestedMetrics.includes('pct_funded')) {
    const budgets = getBudgetsByDBN(school.dbn);
    const currentBudget = budgets.find(b => b.year === '2024-25');
    if (currentBudget) {
      budgetData = {
        total_budget: currentBudget.total_budget_allocation,
        pct_funded: currentBudget.pct_funded,
      };
    }
  }

  let ptaData: { pta_income: number | null } | null = null;
  if (requestedMetrics.includes('pta_income')) {
    const pta = getPTAByDBN(school.dbn);
    const currentPTA = pta.find(p => p.year === '2024-25');
    if (currentPTA) {
      ptaData = { pta_income: currentPTA.total_income };
    }
  }

  let suspensionData: { total_suspensions: number | null } | null = null;
  if (requestedMetrics.includes('total_suspensions')) {
    const suspensions = getSuspensionsByDBN(school.dbn);
    const currentSuspension = suspensions.find(s => s.year === '2024-25');
    if (currentSuspension) {
      suspensionData = { total_suspensions: currentSuspension.total_suspensions };
    }
  }

  // Build the row with all requested metrics
  const row: SchoolComparisonRow = {
    dbn: school.dbn,
    name: school.name,
    borough: school.borough,
    is_charter: school.is_charter,
    impact_score: school.impact_score,
    performance_score: school.performance_score,
    economic_need_index: school.economic_need_index,
    enrollment: school.enrollment,
    category: mapCategory(school.category),
  };

  // Add optional metrics based on what was requested
  if (requestedMetrics.includes('student_attendance')) {
    row.student_attendance = school.student_attendance ?? null;
  }
  if (requestedMetrics.includes('teacher_attendance')) {
    row.teacher_attendance = school.teacher_attendance ?? null;
  }
  if (requestedMetrics.includes('principal_years')) {
    row.principal_years = school.principal_years ?? null;
  }
  if (requestedMetrics.includes('pct_teachers_3plus_years')) {
    row.pct_teachers_3plus_years = school.pct_teachers_3plus_years ?? null;
  }

  // Survey scores
  if (requestedMetrics.includes('survey_family_involvement')) {
    row.survey_family_involvement = school.survey_family_involvement ?? null;
  }
  if (requestedMetrics.includes('survey_family_trust')) {
    row.survey_family_trust = school.survey_family_trust ?? null;
  }
  if (requestedMetrics.includes('survey_safety')) {
    row.survey_safety = school.survey_safety ?? null;
  }
  if (requestedMetrics.includes('survey_communication')) {
    row.survey_communication = school.survey_communication ?? null;
  }
  if (requestedMetrics.includes('survey_instruction')) {
    row.survey_instruction = school.survey_instruction ?? null;
  }
  if (requestedMetrics.includes('survey_leadership')) {
    row.survey_leadership = school.survey_leadership ?? null;
  }
  if (requestedMetrics.includes('survey_support')) {
    row.survey_support = school.survey_support ?? null;
  }

  // Ratings
  if (requestedMetrics.includes('rating_instruction')) {
    row.rating_instruction = school.rating_instruction ?? null;
  }
  if (requestedMetrics.includes('rating_safety')) {
    row.rating_safety = school.rating_safety ?? null;
  }
  if (requestedMetrics.includes('rating_families')) {
    row.rating_families = school.rating_families ?? null;
  }

  // Budget data
  if (budgetData) {
    if (requestedMetrics.includes('total_budget')) {
      row.total_budget = budgetData.total_budget;
    }
    if (requestedMetrics.includes('pct_funded')) {
      row.pct_funded = budgetData.pct_funded;
    }
  }

  // PTA data
  if (ptaData && requestedMetrics.includes('pta_income')) {
    row.pta_income = ptaData.pta_income;
  }

  // Suspension data
  if (suspensionData && requestedMetrics.includes('total_suspensions')) {
    row.total_suspensions = suspensionData.total_suspensions;
  }

  // Trend data
  if (includeTrends && previousMetrics) {
    row.impact_score_change =
      school.impact_score !== null && previousMetrics.impact_score !== null
        ? school.impact_score - previousMetrics.impact_score
        : null;
    row.performance_score_change =
      school.performance_score !== null && previousMetrics.performance_score !== null
        ? school.performance_score - previousMetrics.performance_score
        : null;
  }

  return row;
}

/**
 * Build limitations based on comparison context
 */
function buildLimitations(
  comparisonType: ComparisonType,
  schools: SchoolComparisonRow[],
  requestedMetrics: MetricName[]
): string[] {
  const limitations: string[] = [
    'Based on NYC DOE School Quality Report data',
    'Data from 2024-25 school year',
  ];

  // Check for ENI range warning
  const eniValues = schools.map(s => s.economic_need_index).filter((e): e is number => e !== null);
  if (eniValues.length >= 2) {
    const eniRange = Math.max(...eniValues) - Math.min(...eniValues);
    if (eniRange > 0.2) {
      limitations.push(
        `Schools have different Economic Need Index levels (range: ${eniRange.toFixed(2)}). Direct comparisons may be misleading without accounting for poverty differences.`
      );
    }
  }

  // Check for charter schools in comparison
  const charterCount = schools.filter(s => s.is_charter).length;
  const districtCount = schools.length - charterCount;
  if (charterCount > 0 && districtCount > 0) {
    limitations.push(
      `Comparison includes ${charterCount} charter and ${districtCount} district schools. Charter data may differ due to lottery selection effects.`
    );
  }

  // Budget comparison warning
  if (requestedMetrics.includes('total_budget') || requestedMetrics.includes('pct_funded')) {
    if (charterCount > 0) {
      limitations.push(
        'Charter school budgets are NOT directly comparable to DOE-managed school budgets.'
      );
    }
  }

  // PTA comparison warning
  if (requestedMetrics.includes('pta_income')) {
    limitations.push('PTA income reflects parent wealth, not school quality.');
  }

  // Suspension comparison warning
  if (requestedMetrics.includes('total_suspensions')) {
    limitations.push(
      'Suspension data may include redacted values ("R") for small counts. Suspension rates correlate with poverty and systemic patterns.'
    );
  }

  // Comparison type specific warnings
  if (comparisonType === 'vs_similar') {
    limitations.push(
      'Similar schools matched by ENI (±0.05) and enrollment (±20%). Does not account for programs, leadership, or culture.'
    );
  }

  if (comparisonType === 'filtered') {
    limitations.push(
      'Filtered comparison shows top schools matching criteria. Results may not be representative of all schools in this category.'
    );
  }

  return limitations;
}

// ============================================================================
// Main Tool Implementation
// ============================================================================

/**
 * Compare 2-10 schools across key metrics in a table format.
 */
export function compareSchoolsTool(params: CompareSchoolsParams): CompareSchoolsResult {
  const {
    dbns,
    compare_to_citywide = false,
    compare_to_similar = false,
    metrics,
    include_trends = false,
    filter,
    limit = 5,
  } = params;

  const requestedMetrics = metrics && metrics.length > 0 ? metrics : DEFAULT_METRICS;
  let schools: SchoolWithMetrics[] = [];
  let comparisonType: ComparisonType = 'specific';

  // Option 1: Specific schools by DBN/name
  if (dbns && dbns.length > 0) {
    const resolvedDbns = resolveSchoolIdentifiers(dbns);

    // Fetch each school with metrics
    for (const dbn of resolvedDbns) {
      const school = getSchoolByDBN(dbn);
      const latestMetrics = getLatestMetrics(dbn);
      if (school && latestMetrics) {
        schools.push({
          ...school,
          year: latestMetrics.year,
          enrollment: latestMetrics.enrollment,
          impact_score: latestMetrics.impact_score,
          performance_score: latestMetrics.performance_score,
          economic_need_index: latestMetrics.economic_need_index,
          student_attendance: latestMetrics.student_attendance,
          teacher_attendance: latestMetrics.teacher_attendance,
          principal_years: latestMetrics.principal_years,
          pct_teachers_3plus_years: latestMetrics.pct_teachers_3plus_years,
          category: latestMetrics.category,
          category_criteria: latestMetrics.category_criteria,
          survey_instruction: latestMetrics.survey_instruction,
          survey_safety: latestMetrics.survey_safety,
          survey_leadership: latestMetrics.survey_leadership,
          survey_support: latestMetrics.survey_support,
          survey_communication: latestMetrics.survey_communication,
          survey_family_involvement: latestMetrics.survey_family_involvement,
          survey_family_trust: latestMetrics.survey_family_trust,
          rating_instruction: latestMetrics.rating_instruction,
          rating_safety: latestMetrics.rating_safety,
          rating_families: latestMetrics.rating_families,
        });
      }
    }
    comparisonType = 'specific';
  }

  // Option 2: Filtered schools (e.g., "top 5 Brooklyn high-growth schools")
  if (filter && Object.keys(filter).length > 0) {
    // Map filter category from user-facing to DB values
    // Note: searchSchools only accepts positive categories (high_growth, high_growth_high_achievement, high_achievement)
    // The below_growth_threshold and lower_economic_need categories map to internal DB values
    let dbCategory: string | undefined = filter.category;
    if (filter.category === 'below_growth_threshold') {
      dbCategory = 'developing';
    } else if (filter.category === 'lower_economic_need') {
      dbCategory = 'below_threshold';
    }

    const filteredSchools = searchSchools({
      borough: filter.borough,
      reportType: filter.report_type,
      category: dbCategory as 'high_growth' | 'high_growth_high_achievement' | 'high_achievement' | undefined,
      minEni: filter.min_eni,
      year: '2024-25',
      limit: Math.min(limit, 10),
    });
    schools = filteredSchools;
    comparisonType = 'filtered';
  }

  // Option 3: Compare to similar schools (uses first school as reference)
  if (compare_to_similar && schools.length > 0) {
    const reference = schools[0];
    const similarSchools = findSimilarSchools({
      dbn: reference.dbn,
      sameReportType: true,
      limit: Math.min(limit - 1, 9),
    });
    schools = [reference, ...similarSchools];
    comparisonType = 'vs_similar';
  }

  // Limit to 10 schools max
  schools = schools.slice(0, 10);

  // Build comparison rows
  const rows = schools.map(school =>
    buildComparisonRow(school, include_trends, requestedMetrics)
  );

  // Get citywide stats
  const citywideStats = getCitywideStats('2024-25');

  // Build limitations
  const limitations = buildLimitations(comparisonType, rows, requestedMetrics);

  return {
    comparison: {
      schools: rows,
      metrics_included: requestedMetrics,
      comparison_type: comparisonType,
      include_citywide_column: compare_to_citywide,
    },
    _context: {
      sample_size: rows.length,
      data_year: '2024-25',
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72,
      },
      limitations,
      methodology_note:
        'Compare schools using Impact Score (student growth) and Performance Score together with ENI context. Schools with different ENI levels are not directly comparable.',
    },
  };
}

// ============================================================================
// Tool Definition
// ============================================================================

export const compareSchoolsDefinition = {
  name: 'compare_schools',
  description: `Compare 2-10 schools across key metrics in a table format.

COMPARISON TYPES:
1. Specific schools: Provide list of DBNs or school names to compare
2. School vs citywide: Set compare_to_citywide=true to include median column
3. School vs similar: Set compare_to_similar=true to find peer schools by ENI/enrollment
4. Filtered group: Use filter + limit to compare top schools matching criteria

OUTPUT: Returns structured data for Claude to format as markdown table.

DEFAULT METRICS: Impact Score, Performance Score, ENI, Enrollment, Attendance, Category
OPTIONAL METRICS: Staff (principal_years, pct_teachers_3plus_years), Budget (total_budget, pct_funded), PTA (pta_income), Suspensions (total_suspensions), Surveys, Ratings

IMPORTANT CAVEATS:
- Charter school budgets are NOT comparable to DOE-managed schools
- PTA income reflects parent wealth, not school quality
- Suspension data may be redacted for small counts

ALWAYS include Economic Need Index when comparing school performance.
Schools with different ENI levels are not directly comparable.`,
  parameters: {
    type: 'object',
    properties: {
      dbns: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of school DBNs or names to compare (2-10 schools). Names will be resolved to DBNs automatically.',
        maxItems: 10,
        minItems: 1,
      },
      compare_to_citywide: {
        type: 'boolean',
        description: 'Include citywide median as reference column',
      },
      compare_to_similar: {
        type: 'boolean',
        description: 'Compare first school to similar peers by ENI/enrollment',
      },
      metrics: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            // Core metrics (default comparison set)
            'impact_score',
            'performance_score',
            'economic_need_index',
            'enrollment',
            // Attendance
            'student_attendance',
            'teacher_attendance',
            // Staff
            'principal_years',
            'pct_teachers_3plus_years',
            // Budget (from school_budgets table)
            'total_budget',
            'pct_funded',
            // PTA (from pta_data table)
            'pta_income',
            // Suspensions (from school_suspensions table)
            'total_suspensions',
            // Survey scores
            'survey_family_involvement',
            'survey_family_trust',
            'survey_safety',
            'survey_communication',
            'survey_instruction',
            'survey_leadership',
            'survey_support',
            // Ratings (string values like "Meeting Target")
            'rating_instruction',
            'rating_safety',
            'rating_families',
            // Category
            'category',
          ],
        },
        description:
          'Specific metrics to compare. Default: core metrics (impact, performance, ENI, enrollment, attendance, category). Budget/PTA/suspensions are optional and have caveats.',
      },
      include_trends: {
        type: 'boolean',
        description: 'Include year-over-year change columns for Impact and Performance scores',
      },
      filter: {
        type: 'object',
        properties: {
          borough: {
            type: 'string',
            enum: ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'],
          },
          report_type: {
            type: 'string',
            enum: ['EMS', 'HS', 'HST', 'D75', 'EC'],
          },
          category: {
            type: 'string',
            enum: [
              'high_growth',
              'high_growth_high_achievement',
              'high_achievement',
              'below_growth_threshold',
              'lower_economic_need',
            ],
          },
          min_eni: { type: 'number' },
        },
        description: 'Filter schools before comparing (for "top 5 Brooklyn schools" type queries)',
      },
      limit: {
        type: 'number',
        default: 5,
        maximum: 10,
        description: 'Max schools when using filter (default: 5, max: 10)',
      },
    },
  },
};
