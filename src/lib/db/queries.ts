import { getDatabase } from './connection';
import type { School, SchoolMetrics, SchoolWithMetrics, CitywideStat, SchoolLocation, SchoolBudget, SchoolSuspension, PTAData } from '@/types/school';

// ============================================================================
// School Queries
// ============================================================================

export function getSchoolByDBN(dbn: string): School | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM schools WHERE dbn = ?').get(dbn) as School | undefined;
}

export function getAllSchools(): School[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM schools ORDER BY name').all() as School[];
}

export function getSchoolsByBorough(borough: string): School[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM schools WHERE borough = ? ORDER BY name').all(borough) as School[];
}

export function getSchoolsByType(reportType: string): School[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM schools WHERE report_type = ? ORDER BY name').all(reportType) as School[];
}

// ============================================================================
// School Metrics Queries
// ============================================================================

export function getMetricsByDBN(dbn: string, year?: string): SchoolMetrics[] {
  const db = getDatabase();
  if (year) {
    return db.prepare('SELECT * FROM school_metrics WHERE dbn = ? AND year = ?').all(dbn, year) as SchoolMetrics[];
  }
  return db.prepare('SELECT * FROM school_metrics WHERE dbn = ? ORDER BY year DESC').all(dbn) as SchoolMetrics[];
}

export function getLatestMetrics(dbn: string): SchoolMetrics | undefined {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM school_metrics
    WHERE dbn = ?
    ORDER BY year DESC
    LIMIT 1
  `).get(dbn) as SchoolMetrics | undefined;
}

// ============================================================================
// Combined School + Metrics Queries
// ============================================================================

export interface SearchParams {
  borough?: string;
  reportType?: string;
  schoolType?: string;
  minImpactScore?: number;
  maxImpactScore?: number;
  minPerformanceScore?: number;
  maxPerformanceScore?: number;
  minEni?: number;
  maxEni?: number;
  minEnrollment?: number;
  maxEnrollment?: number;
  category?: string;
  isCharter?: boolean;
  year?: string;
  limit?: number;
  offset?: number;
}

export function searchSchools(params: SearchParams): SchoolWithMetrics[] {
  const db = getDatabase();
  const year = params.year || '2024-25';
  const limit = Math.min(params.limit || 25, 100);
  const offset = params.offset || 0;

  const conditions: string[] = ['m.year = ?'];
  const values: (string | number | boolean)[] = [year];

  if (params.borough) {
    conditions.push('s.borough = ?');
    values.push(params.borough);
  }

  if (params.reportType) {
    conditions.push('s.report_type = ?');
    values.push(params.reportType);
  }

  if (params.schoolType) {
    conditions.push('s.school_type = ?');
    values.push(params.schoolType);
  }

  if (params.isCharter !== undefined) {
    conditions.push('s.is_charter = ?');
    values.push(params.isCharter ? 1 : 0);
  }

  if (params.minImpactScore !== undefined) {
    conditions.push('m.impact_score >= ?');
    values.push(params.minImpactScore);
  }

  if (params.maxImpactScore !== undefined) {
    conditions.push('m.impact_score <= ?');
    values.push(params.maxImpactScore);
  }

  if (params.minPerformanceScore !== undefined) {
    conditions.push('m.performance_score >= ?');
    values.push(params.minPerformanceScore);
  }

  if (params.maxPerformanceScore !== undefined) {
    conditions.push('m.performance_score <= ?');
    values.push(params.maxPerformanceScore);
  }

  if (params.minEni !== undefined) {
    conditions.push('m.economic_need_index >= ?');
    values.push(params.minEni);
  }

  if (params.maxEni !== undefined) {
    conditions.push('m.economic_need_index <= ?');
    values.push(params.maxEni);
  }

  if (params.minEnrollment !== undefined) {
    conditions.push('m.enrollment >= ?');
    values.push(params.minEnrollment);
  }

  if (params.maxEnrollment !== undefined) {
    conditions.push('m.enrollment <= ?');
    values.push(params.maxEnrollment);
  }

  if (params.category) {
    conditions.push('m.category = ?');
    values.push(params.category);
  }

  const sql = `
    SELECT
      s.dbn, s.name, s.borough, s.district, s.school_type, s.report_type, s.is_charter,
      m.year, m.enrollment, m.impact_score, m.performance_score, m.economic_need_index,
      m.rating_instruction, m.rating_safety, m.rating_families,
      m.survey_instruction, m.survey_safety, m.survey_leadership,
      m.student_attendance, m.teacher_attendance, m.principal_years,
      m.pct_teachers_3plus_years, m.category, m.category_criteria
    FROM schools s
    JOIN school_metrics m ON s.dbn = m.dbn
    WHERE ${conditions.join(' AND ')}
    ORDER BY m.impact_score DESC
    LIMIT ? OFFSET ?
  `;

  values.push(limit, offset);

  return db.prepare(sql).all(...values) as SchoolWithMetrics[];
}

export function countSchools(params: Omit<SearchParams, 'limit' | 'offset'>): number {
  const db = getDatabase();
  const year = params.year || '2024-25';

  const conditions: string[] = ['m.year = ?'];
  const values: (string | number | boolean)[] = [year];

  if (params.borough) {
    conditions.push('s.borough = ?');
    values.push(params.borough);
  }

  if (params.category) {
    conditions.push('m.category = ?');
    values.push(params.category);
  }

  // Add other filters as needed (simplified for count)

  const sql = `
    SELECT COUNT(*) as count
    FROM schools s
    JOIN school_metrics m ON s.dbn = m.dbn
    WHERE ${conditions.join(' AND ')}
  `;

  const result = db.prepare(sql).get(...values) as { count: number };
  return result.count;
}

// ============================================================================
// Category Queries
// ============================================================================

/**
 * Get schools by category with optional report type filter.
 * Default: EMS (Elementary/Middle Schools) - the scope of the original Hidden Gems analysis.
 */
export function getSchoolsByCategory(
  category: string,
  year?: string,
  limit?: number,
  reportType?: string | 'all'
): SchoolWithMetrics[] {
  return searchSchools({
    category,
    year: year || '2024-25',
    limit: limit || 100,
    reportType: reportType === 'all' ? undefined : (reportType || 'EMS')
  });
}

/**
 * Get persistent gems with optional report type filter.
 * Default: EMS (Elementary/Middle Schools) - the scope of the original analysis.
 */
export function getPersistentGems(reportType?: string | 'all'): SchoolWithMetrics[] {
  const db = getDatabase();

  const reportTypeFilter = reportType === 'all'
    ? ''
    : `AND s.report_type = '${reportType || 'EMS'}'`;

  const sql = `
    SELECT
      s.dbn, s.name, s.borough, s.district, s.school_type, s.report_type, s.is_charter,
      m.year, m.enrollment, m.impact_score, m.performance_score, m.economic_need_index,
      m.rating_instruction, m.rating_safety, m.rating_families,
      m.category, m.category_criteria
    FROM persistent_gems pg
    JOIN schools s ON pg.dbn = s.dbn
    JOIN school_metrics m ON s.dbn = m.dbn
    WHERE m.year = '2024-25'
    ${reportTypeFilter}
    ORDER BY m.impact_score DESC
  `;

  return db.prepare(sql).all() as SchoolWithMetrics[];
}

/**
 * Get category statistics for EMS schools (the scope of the Hidden Gems analysis).
 * Returns dynamic counts rather than hardcoded values.
 */
export function getEMSCategoryStats(year?: string): {
  hidden_gems: number;
  elite: number;
  anomalies: number;
  typical: number;
  total_high_poverty: number;
  persistent_gems: number;
} {
  const db = getDatabase();
  const targetYear = year || '2024-25';

  const sql = `
    SELECT
      m.category,
      COUNT(*) as count
    FROM school_metrics m
    JOIN schools s ON m.dbn = s.dbn
    WHERE s.report_type = 'EMS'
    AND m.year = ?
    AND m.economic_need_index >= 0.85
    GROUP BY m.category
  `;

  const results = db.prepare(sql).all(targetYear) as { category: string; count: number }[];

  const stats = {
    hidden_gems: 0,
    elite: 0,
    anomalies: 0,
    typical: 0,
    total_high_poverty: 0,
    persistent_gems: 0
  };

  for (const row of results) {
    switch (row.category) {
      case 'hidden_gem':
        stats.hidden_gems = row.count;
        break;
      case 'elite':
        stats.elite = row.count;
        break;
      case 'anomaly':
        stats.anomalies = row.count;
        break;
      case 'typical':
        stats.typical = row.count;
        break;
    }
    stats.total_high_poverty += row.count;
  }

  // Get persistent gems count for EMS
  const persistentSql = `
    SELECT COUNT(*) as count
    FROM persistent_gems pg
    JOIN schools s ON pg.dbn = s.dbn
    WHERE s.report_type = 'EMS'
  `;
  const persistentResult = db.prepare(persistentSql).get() as { count: number };
  stats.persistent_gems = persistentResult.count;

  return stats;
}

// ============================================================================
// Similar Schools
// ============================================================================

export interface SimilarSchoolParams {
  dbn: string;
  eniTolerance?: number;      // Default ±0.05
  enrollmentTolerance?: number; // Default ±20%
  sameBorough?: boolean;
  sameReportType?: boolean;
  limit?: number;
}

export function findSimilarSchools(params: SimilarSchoolParams): SchoolWithMetrics[] {
  const db = getDatabase();
  const { dbn, eniTolerance = 0.05, enrollmentTolerance = 0.2, limit = 5 } = params;

  // First get the reference school
  const refSchool = getLatestMetrics(dbn);
  if (!refSchool) return [];

  const conditions: string[] = [
    'm.year = ?',
    's.dbn != ?'
  ];
  const values: (string | number)[] = ['2024-25', dbn];

  // ENI tolerance
  if (refSchool.economic_need_index) {
    const eniMin = refSchool.economic_need_index - eniTolerance;
    const eniMax = refSchool.economic_need_index + eniTolerance;
    conditions.push('m.economic_need_index BETWEEN ? AND ?');
    values.push(eniMin, eniMax);
  }

  // Enrollment tolerance
  if (refSchool.enrollment) {
    const enrollMin = Math.floor(refSchool.enrollment * (1 - enrollmentTolerance));
    const enrollMax = Math.ceil(refSchool.enrollment * (1 + enrollmentTolerance));
    conditions.push('m.enrollment BETWEEN ? AND ?');
    values.push(enrollMin, enrollMax);
  }

  if (params.sameBorough) {
    const school = getSchoolByDBN(dbn);
    if (school) {
      conditions.push('s.borough = ?');
      values.push(school.borough);
    }
  }

  if (params.sameReportType) {
    const school = getSchoolByDBN(dbn);
    if (school) {
      conditions.push('s.report_type = ?');
      values.push(school.report_type);
    }
  }

  const sql = `
    SELECT
      s.dbn, s.name, s.borough, s.district, s.school_type, s.report_type, s.is_charter,
      m.year, m.enrollment, m.impact_score, m.performance_score, m.economic_need_index,
      m.category
    FROM schools s
    JOIN school_metrics m ON s.dbn = m.dbn
    WHERE ${conditions.join(' AND ')}
    ORDER BY ABS(m.economic_need_index - ?) + ABS(CAST(m.enrollment AS REAL) / ? - 1)
    LIMIT ?
  `;

  values.push(refSchool.economic_need_index || 0, refSchool.enrollment || 1, limit);

  return db.prepare(sql).all(...values) as SchoolWithMetrics[];
}

// ============================================================================
// Statistics
// ============================================================================

export function getCitywideStats(year?: string): CitywideStat | undefined {
  const db = getDatabase();
  const targetYear = year || '2024-25';
  return db.prepare('SELECT * FROM citywide_stats WHERE year = ?').get(targetYear) as CitywideStat | undefined;
}

// Map cross-table metric names to their SQL expressions and join requirements
const CROSS_TABLE_METRICS: Record<string, { table: string; column: string; joinOn: string; yearColumn?: string }> = {
  total_budget: { table: 'school_budgets', column: 'total_budget_allocation', joinOn: 'dbn', yearColumn: 'year' },
  pct_funded: { table: 'school_budgets', column: 'pct_funded', joinOn: 'dbn', yearColumn: 'year' },
  total_suspensions: { table: 'school_suspensions', column: 'total_suspensions', joinOn: 'dbn', yearColumn: 'year' },
  pta_income: { table: 'pta_data', column: 'total_income', joinOn: 'dbn', yearColumn: 'year' },
};

export function getCorrelation(metric1: string, metric2: string, filters?: Partial<SearchParams>): {
  correlation: number;
  sampleSize: number;
  metric1Mean: number;
  metric2Mean: number;
} | null {
  const db = getDatabase();
  const year = filters?.year || '2024-25';

  // Determine if we need cross-table joins
  const m1Cross = CROSS_TABLE_METRICS[metric1];
  const m2Cross = CROSS_TABLE_METRICS[metric2];

  // Build metric expressions
  const m1Expr = m1Cross ? `t1.${m1Cross.column}` : `m.${metric1}`;
  const m2Expr = m2Cross ? `t2.${m2Cross.column}` : `m.${metric2}`;

  // Build JOINs
  const joins: string[] = [];
  if (m1Cross) {
    joins.push(`JOIN ${m1Cross.table} t1 ON m.dbn = t1.${m1Cross.joinOn}${m1Cross.yearColumn ? ` AND m.year = t1.${m1Cross.yearColumn}` : ''}`);
  }
  if (m2Cross) {
    joins.push(`JOIN ${m2Cross.table} t2 ON m.dbn = t2.${m2Cross.joinOn}${m2Cross.yearColumn ? ` AND m.year = t2.${m2Cross.yearColumn}` : ''}`);
  }

  const conditions: string[] = ['m.year = ?', `${m1Expr} IS NOT NULL`, `${m2Expr} IS NOT NULL`];
  const values: (string | number)[] = [year];

  if (filters?.category) {
    conditions.push('m.category = ?');
    values.push(filters.category);
  }

  if (filters?.minEni !== undefined) {
    conditions.push('m.economic_need_index >= ?');
    values.push(filters.minEni);
  }

  // Calculate Pearson correlation coefficient using SQL
  const sql = `
    WITH filtered AS (
      SELECT ${m1Expr} as x, ${m2Expr} as y
      FROM school_metrics m
      ${joins.join('\n      ')}
      WHERE ${conditions.join(' AND ')}
    ),
    stats AS (
      SELECT
        AVG(x) as mean_x,
        AVG(y) as mean_y,
        COUNT(*) as n
      FROM filtered
    )
    SELECT
      stats.n as sample_size,
      stats.mean_x,
      stats.mean_y,
      CASE
        WHEN stats.n < 3 THEN NULL
        ELSE (
          SUM((filtered.x - stats.mean_x) * (filtered.y - stats.mean_y)) /
          (SQRT(SUM((filtered.x - stats.mean_x) * (filtered.x - stats.mean_x))) *
           SQRT(SUM((filtered.y - stats.mean_y) * (filtered.y - stats.mean_y))))
        )
      END as correlation
    FROM filtered, stats
    GROUP BY stats.n, stats.mean_x, stats.mean_y
  `;

  try {
    const result = db.prepare(sql).get(...values) as {
      sample_size: number;
      mean_x: number;
      mean_y: number;
      correlation: number | null;
    } | undefined;

    if (!result || result.correlation === null) return null;

    return {
      correlation: result.correlation,
      sampleSize: result.sample_size,
      metric1Mean: result.mean_x,
      metric2Mean: result.mean_y
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Location, Budget, Suspension, PTA Queries
// ============================================================================

export function getLocationByDBN(dbn: string): SchoolLocation | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM school_locations WHERE dbn = ?').get(dbn) as SchoolLocation | undefined;
}

export function getBudgetsByDBN(dbn: string): SchoolBudget[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM school_budgets WHERE dbn = ? ORDER BY year DESC').all(dbn) as SchoolBudget[];
}

export function getSuspensionsByDBN(dbn: string): SchoolSuspension[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM school_suspensions WHERE dbn = ? ORDER BY year DESC').all(dbn) as SchoolSuspension[];
}

export function getPTAByDBN(dbn: string): PTAData[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM pta_data WHERE dbn = ? ORDER BY year DESC').all(dbn) as PTAData[];
}

// ============================================================================
// School Profile (Complete)
// ============================================================================

export interface SchoolProfile {
  school: School;
  metrics: {
    current: SchoolMetrics | undefined;
    previous: SchoolMetrics | undefined;
  };
  isPersistentGem: boolean;
  similarSchools: SchoolWithMetrics[];
  citywideStats: CitywideStat | undefined;
  location: SchoolLocation | undefined;
  budgets: SchoolBudget[];
  suspensions: SchoolSuspension[];
  pta: PTAData[];
}

export function getSchoolProfile(dbn: string): SchoolProfile | null {
  const school = getSchoolByDBN(dbn);
  if (!school) return null;

  const allMetrics = getMetricsByDBN(dbn);
  const currentMetrics = allMetrics.find(m => m.year === '2024-25');
  const previousMetrics = allMetrics.find(m => m.year === '2023-24');

  // Check if persistent gem
  const db = getDatabase();
  const isPersistent = db.prepare('SELECT 1 FROM persistent_gems WHERE dbn = ?').get(dbn);

  // Get similar schools
  const similarSchools = findSimilarSchools({
    dbn,
    sameReportType: true,
    limit: 5
  });

  // Get citywide stats for context
  const citywideStats = getCitywideStats('2024-25');

  // Get new data sources
  const location = getLocationByDBN(dbn);
  const budgets = getBudgetsByDBN(dbn);
  const suspensions = getSuspensionsByDBN(dbn);
  const pta = getPTAByDBN(dbn);

  return {
    school,
    metrics: {
      current: currentMetrics,
      previous: previousMetrics
    },
    isPersistentGem: !!isPersistent,
    similarSchools,
    citywideStats,
    location,
    budgets,
    suspensions,
    pta
  };
}
