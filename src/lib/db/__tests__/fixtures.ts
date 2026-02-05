/**
 * Test fixtures for database tests.
 * Provides representative sample data covering various categories, boroughs, and edge cases.
 */

import type { School, SchoolMetrics, CitywideStat, SchoolLocation, SchoolBudget, SchoolSuspension, PTAData } from '@/types/school';

// ============================================================================
// Schools
// ============================================================================

export const testSchools: School[] = [
  // High growth + high achievement EMS in Brooklyn
  {
    dbn: '13K123',
    name: 'P.S. 123 Excellence Academy',
    borough: 'Brooklyn',
    district: '13',
    school_type: 'Elementary',
    report_type: 'EMS',
    is_charter: false,
  },
  // High growth (not high achievement) EMS in Bronx
  {
    dbn: '09X456',
    name: 'P.S. 456 Community School',
    borough: 'Bronx',
    district: '09',
    school_type: 'Elementary',
    report_type: 'EMS',
    is_charter: false,
  },
  // High achievement (not high growth) EMS in Manhattan
  {
    dbn: '02M789',
    name: 'M.S. 789 Manhattan Middle',
    borough: 'Manhattan',
    district: '02',
    school_type: 'Middle',
    report_type: 'EMS',
    is_charter: false,
  },
  // Developing EMS in Queens
  {
    dbn: '24Q234',
    name: 'P.S. 234 Queens Elementary',
    borough: 'Queens',
    district: '24',
    school_type: 'Elementary',
    report_type: 'EMS',
    is_charter: false,
  },
  // Below ENI threshold (lower economic need) in Staten Island
  {
    dbn: '31R567',
    name: 'I.S. 567 Staten Island Intermediate',
    borough: 'Staten Island',
    district: '31',
    school_type: 'Middle',
    report_type: 'EMS',
    is_charter: false,
  },
  // High School in Manhattan
  {
    dbn: '02M999',
    name: 'Manhattan High School',
    borough: 'Manhattan',
    district: '02',
    school_type: 'High School',
    report_type: 'HS',
    is_charter: false,
  },
  // Charter school in Brooklyn
  {
    dbn: '84K001',
    name: 'Brooklyn Charter Academy',
    borough: 'Brooklyn',
    district: '84',
    school_type: 'Elementary',
    report_type: 'EMS',
    is_charter: true,
  },
  // District 75 school
  {
    dbn: '75X111',
    name: 'D75 Special Programs',
    borough: 'Bronx',
    district: '75',
    school_type: 'Special Education',
    report_type: 'D75',
    is_charter: false,
  },
  // School with NULL scores (simulating 2022-23 data)
  {
    dbn: '01M188',
    name: 'P.S. 188 The Island School',
    borough: 'Manhattan',
    district: '01',
    school_type: 'Elementary',
    report_type: 'EMS',
    is_charter: false,
  },
  // School for fuzzy search testing (Stuyvesant)
  {
    dbn: '02M475',
    name: 'Stuyvesant High School',
    borough: 'Manhattan',
    district: '02',
    school_type: 'High School',
    report_type: 'HS',
    is_charter: false,
  },
  // Small enrollment school
  {
    dbn: '14K333',
    name: 'Small Learning Community School',
    borough: 'Brooklyn',
    district: '14',
    school_type: 'Elementary',
    report_type: 'EMS',
    is_charter: false,
  },
  // Large enrollment school
  {
    dbn: '10X555',
    name: 'Large Bronx Academy',
    borough: 'Bronx',
    district: '10',
    school_type: 'Middle',
    report_type: 'EMS',
    is_charter: false,
  },
];

// ============================================================================
// School Metrics
// ============================================================================

export const testMetrics: SchoolMetrics[] = [
  // 13K123 - High growth + high achievement (2024-25)
  {
    id: 1,
    dbn: '13K123',
    year: '2024-25',
    enrollment: 450,
    impact_score: 0.62,
    performance_score: 0.58,
    economic_need_index: 0.91,
    rating_instruction: 'Exceeding Target',
    rating_safety: 'Meeting Target',
    rating_families: 'Exceeding Target',
    survey_instruction: 0.78,
    survey_safety: 0.82,
    survey_leadership: 0.75,
    survey_support: 0.80,
    survey_communication: 0.77,
    survey_family_involvement: 0.72,
    survey_family_trust: 0.85,
    pct_ell: 0.12,
    pct_iep: 0.15,
    pct_temp_housing: 0.05,
    pct_hra_eligible: 0.78,
    principal_years: 5,
    pct_teachers_3plus_years: 0.72,
    student_attendance: 0.94,
    teacher_attendance: 0.96,
    category: 'high_growth_high_achievement',
    category_criteria: '{"impact":">=0.55","performance":">=0.50","eni":">=0.85"}',
  },
  // 13K123 - Previous year (2023-24)
  {
    id: 2,
    dbn: '13K123',
    year: '2023-24',
    enrollment: 440,
    impact_score: 0.58,
    performance_score: 0.54,
    economic_need_index: 0.90,
    rating_instruction: 'Meeting Target',
    rating_safety: 'Meeting Target',
    rating_families: 'Meeting Target',
    survey_instruction: 0.75,
    survey_safety: 0.80,
    survey_leadership: 0.73,
    survey_support: 0.78,
    survey_communication: 0.75,
    survey_family_involvement: 0.70,
    survey_family_trust: 0.82,
    pct_ell: 0.11,
    pct_iep: 0.14,
    pct_temp_housing: 0.04,
    pct_hra_eligible: 0.76,
    principal_years: 4,
    pct_teachers_3plus_years: 0.70,
    student_attendance: 0.93,
    teacher_attendance: 0.95,
    category: 'high_growth_high_achievement',
    category_criteria: '{"impact":">=0.55","performance":">=0.50","eni":">=0.85"}',
  },
  // 09X456 - High growth (not high achievement)
  {
    id: 3,
    dbn: '09X456',
    year: '2024-25',
    enrollment: 380,
    impact_score: 0.59,
    performance_score: 0.42,
    economic_need_index: 0.95,
    rating_instruction: 'Meeting Target',
    rating_safety: 'Meeting Target',
    rating_families: 'Meeting Target',
    survey_instruction: 0.70,
    survey_safety: 0.72,
    survey_leadership: 0.68,
    survey_support: 0.71,
    survey_communication: 0.69,
    survey_family_involvement: 0.65,
    survey_family_trust: 0.74,
    pct_ell: 0.22,
    pct_iep: 0.18,
    pct_temp_housing: 0.12,
    pct_hra_eligible: 0.88,
    principal_years: 3,
    pct_teachers_3plus_years: 0.65,
    student_attendance: 0.91,
    teacher_attendance: 0.94,
    category: 'high_growth',
    category_criteria: '{"impact":">=0.55","performance":"<0.50","eni":">=0.85"}',
  },
  // 02M789 - High achievement (not high growth)
  {
    id: 4,
    dbn: '02M789',
    year: '2024-25',
    enrollment: 520,
    impact_score: 0.48,
    performance_score: 0.65,
    economic_need_index: 0.88,
    rating_instruction: 'Exceeding Target',
    rating_safety: 'Exceeding Target',
    rating_families: 'Meeting Target',
    survey_instruction: 0.82,
    survey_safety: 0.85,
    survey_leadership: 0.80,
    survey_support: 0.83,
    survey_communication: 0.81,
    survey_family_involvement: 0.78,
    survey_family_trust: 0.86,
    pct_ell: 0.08,
    pct_iep: 0.12,
    pct_temp_housing: 0.02,
    pct_hra_eligible: 0.65,
    principal_years: 8,
    pct_teachers_3plus_years: 0.82,
    student_attendance: 0.96,
    teacher_attendance: 0.97,
    category: 'high_achievement',
    category_criteria: '{"impact":"<0.55","performance":">=0.50","eni":">=0.85"}',
  },
  // 24Q234 - Developing
  {
    id: 5,
    dbn: '24Q234',
    year: '2024-25',
    enrollment: 410,
    impact_score: 0.45,
    performance_score: 0.38,
    economic_need_index: 0.92,
    rating_instruction: 'Approaching Target',
    rating_safety: 'Meeting Target',
    rating_families: 'Approaching Target',
    survey_instruction: 0.65,
    survey_safety: 0.70,
    survey_leadership: 0.62,
    survey_support: 0.66,
    survey_communication: 0.64,
    survey_family_involvement: 0.58,
    survey_family_trust: 0.68,
    pct_ell: 0.28,
    pct_iep: 0.20,
    pct_temp_housing: 0.08,
    pct_hra_eligible: 0.82,
    principal_years: 2,
    pct_teachers_3plus_years: 0.55,
    student_attendance: 0.89,
    teacher_attendance: 0.93,
    category: 'developing',
    category_criteria: '{"impact":"<0.55","performance":"<0.50","eni":">=0.85"}',
  },
  // 31R567 - Below ENI threshold
  {
    id: 6,
    dbn: '31R567',
    year: '2024-25',
    enrollment: 600,
    impact_score: 0.52,
    performance_score: 0.72,
    economic_need_index: 0.45,
    rating_instruction: 'Exceeding Target',
    rating_safety: 'Exceeding Target',
    rating_families: 'Exceeding Target',
    survey_instruction: 0.88,
    survey_safety: 0.90,
    survey_leadership: 0.86,
    survey_support: 0.89,
    survey_communication: 0.87,
    survey_family_involvement: 0.85,
    survey_family_trust: 0.91,
    pct_ell: 0.04,
    pct_iep: 0.10,
    pct_temp_housing: 0.01,
    pct_hra_eligible: 0.35,
    principal_years: 10,
    pct_teachers_3plus_years: 0.88,
    student_attendance: 0.97,
    teacher_attendance: 0.98,
    category: 'below_threshold',
    category_criteria: '{"eni":"<0.85"}',
  },
  // 02M999 - High School
  {
    id: 7,
    dbn: '02M999',
    year: '2024-25',
    enrollment: 1200,
    impact_score: 0.56,
    performance_score: 0.61,
    economic_need_index: 0.75,
    rating_instruction: 'Meeting Target',
    rating_safety: 'Meeting Target',
    rating_families: 'Meeting Target',
    survey_instruction: 0.76,
    survey_safety: 0.78,
    survey_leadership: 0.74,
    survey_support: 0.77,
    survey_communication: 0.75,
    survey_family_involvement: 0.71,
    survey_family_trust: 0.79,
    pct_ell: 0.06,
    pct_iep: 0.11,
    pct_temp_housing: 0.03,
    pct_hra_eligible: 0.58,
    principal_years: 6,
    pct_teachers_3plus_years: 0.78,
    student_attendance: 0.92,
    teacher_attendance: 0.95,
    category: 'below_threshold',
    category_criteria: '{"eni":"<0.85"}',
  },
  // 84K001 - Charter
  {
    id: 8,
    dbn: '84K001',
    year: '2024-25',
    enrollment: 320,
    impact_score: 0.68,
    performance_score: 0.55,
    economic_need_index: 0.89,
    rating_instruction: 'Exceeding Target',
    rating_safety: 'Exceeding Target',
    rating_families: 'Meeting Target',
    survey_instruction: 0.80,
    survey_safety: 0.83,
    survey_leadership: 0.78,
    survey_support: 0.81,
    survey_communication: 0.79,
    survey_family_involvement: 0.74,
    survey_family_trust: 0.84,
    pct_ell: 0.09,
    pct_iep: 0.08,
    pct_temp_housing: 0.04,
    pct_hra_eligible: 0.75,
    principal_years: 4,
    pct_teachers_3plus_years: 0.60,
    student_attendance: 0.95,
    teacher_attendance: 0.96,
    category: 'high_growth_high_achievement',
    category_criteria: '{"impact":">=0.55","performance":">=0.50","eni":">=0.85"}',
  },
  // 75X111 - District 75
  {
    id: 9,
    dbn: '75X111',
    year: '2024-25',
    enrollment: 150,
    impact_score: null,
    performance_score: null,
    economic_need_index: 0.94,
    rating_instruction: 'Meeting Target',
    rating_safety: 'Meeting Target',
    rating_families: 'Meeting Target',
    survey_instruction: 0.72,
    survey_safety: 0.75,
    survey_leadership: 0.70,
    survey_support: 0.73,
    survey_communication: 0.71,
    survey_family_involvement: 0.68,
    survey_family_trust: 0.76,
    pct_ell: 0.15,
    pct_iep: 1.00,
    pct_temp_housing: 0.10,
    pct_hra_eligible: 0.85,
    principal_years: 7,
    pct_teachers_3plus_years: 0.75,
    student_attendance: 0.88,
    teacher_attendance: 0.94,
    category: null,
    category_criteria: null,
  },
  // 01M188 - 2022-23 data (NULL Impact/Performance scores)
  {
    id: 10,
    dbn: '01M188',
    year: '2022-23',
    enrollment: 400,
    impact_score: null,
    performance_score: null,
    economic_need_index: 0.87,
    rating_instruction: 'Meeting Target',
    rating_safety: 'Meeting Target',
    rating_families: 'Meeting Target',
    survey_instruction: 0.73,
    survey_safety: 0.76,
    survey_leadership: 0.71,
    survey_support: 0.74,
    survey_communication: 0.72,
    survey_family_involvement: 0.69,
    survey_family_trust: 0.77,
    pct_ell: 0.14,
    pct_iep: 0.16,
    pct_temp_housing: 0.06,
    pct_hra_eligible: 0.72,
    principal_years: 5,
    pct_teachers_3plus_years: 0.68,
    student_attendance: 0.92,
    teacher_attendance: 0.95,
    category: null,
    category_criteria: null,
  },
  // 01M188 - 2024-25 data
  {
    id: 11,
    dbn: '01M188',
    year: '2024-25',
    enrollment: 420,
    impact_score: 0.54,
    performance_score: 0.48,
    economic_need_index: 0.86,
    rating_instruction: 'Meeting Target',
    rating_safety: 'Exceeding Target',
    rating_families: 'Meeting Target',
    survey_instruction: 0.75,
    survey_safety: 0.80,
    survey_leadership: 0.73,
    survey_support: 0.76,
    survey_communication: 0.74,
    survey_family_involvement: 0.71,
    survey_family_trust: 0.79,
    pct_ell: 0.13,
    pct_iep: 0.15,
    pct_temp_housing: 0.05,
    pct_hra_eligible: 0.70,
    principal_years: 7,
    pct_teachers_3plus_years: 0.72,
    student_attendance: 0.93,
    teacher_attendance: 0.96,
    category: 'developing',
    category_criteria: '{"impact":"<0.55","performance":"<0.50","eni":">=0.85"}',
  },
  // 02M475 - Stuyvesant High School
  {
    id: 12,
    dbn: '02M475',
    year: '2024-25',
    enrollment: 3300,
    impact_score: 0.72,
    performance_score: 0.95,
    economic_need_index: 0.42,
    rating_instruction: 'Exceeding Target',
    rating_safety: 'Exceeding Target',
    rating_families: 'Exceeding Target',
    survey_instruction: 0.92,
    survey_safety: 0.94,
    survey_leadership: 0.90,
    survey_support: 0.91,
    survey_communication: 0.89,
    survey_family_involvement: 0.87,
    survey_family_trust: 0.93,
    pct_ell: 0.02,
    pct_iep: 0.05,
    pct_temp_housing: 0.00,
    pct_hra_eligible: 0.30,
    principal_years: 12,
    pct_teachers_3plus_years: 0.92,
    student_attendance: 0.98,
    teacher_attendance: 0.99,
    category: 'below_threshold',
    category_criteria: '{"eni":"<0.85"}',
  },
  // 14K333 - Small enrollment
  {
    id: 13,
    dbn: '14K333',
    year: '2024-25',
    enrollment: 85,
    impact_score: 0.57,
    performance_score: 0.51,
    economic_need_index: 0.90,
    rating_instruction: 'Meeting Target',
    rating_safety: 'Meeting Target',
    rating_families: 'Exceeding Target',
    survey_instruction: 0.77,
    survey_safety: 0.79,
    survey_leadership: 0.76,
    survey_support: 0.78,
    survey_communication: 0.75,
    survey_family_involvement: 0.80,
    survey_family_trust: 0.82,
    pct_ell: 0.10,
    pct_iep: 0.14,
    pct_temp_housing: 0.04,
    pct_hra_eligible: 0.74,
    principal_years: 3,
    pct_teachers_3plus_years: 0.62,
    student_attendance: 0.94,
    teacher_attendance: 0.96,
    category: 'high_growth_high_achievement',
    category_criteria: '{"impact":">=0.55","performance":">=0.50","eni":">=0.85"}',
  },
  // 10X555 - Large enrollment
  {
    id: 14,
    dbn: '10X555',
    year: '2024-25',
    enrollment: 1500,
    impact_score: 0.51,
    performance_score: 0.47,
    economic_need_index: 0.93,
    rating_instruction: 'Meeting Target',
    rating_safety: 'Approaching Target',
    rating_families: 'Meeting Target',
    survey_instruction: 0.68,
    survey_safety: 0.65,
    survey_leadership: 0.66,
    survey_support: 0.67,
    survey_communication: 0.65,
    survey_family_involvement: 0.60,
    survey_family_trust: 0.70,
    pct_ell: 0.25,
    pct_iep: 0.19,
    pct_temp_housing: 0.09,
    pct_hra_eligible: 0.84,
    principal_years: 4,
    pct_teachers_3plus_years: 0.58,
    student_attendance: 0.88,
    teacher_attendance: 0.92,
    category: 'developing',
    category_criteria: '{"impact":"<0.55","performance":"<0.50","eni":">=0.85"}',
  },
];

// ============================================================================
// Citywide Stats
// ============================================================================

export const testCitywideStats: CitywideStat[] = [
  {
    year: '2024-25',
    median_impact_score: 0.50,
    median_performance_score: 0.49,
    median_economic_need: 0.72,
    mean_impact_score: 0.50,
    mean_performance_score: 0.50,
    mean_economic_need: 0.70,
    total_schools: 1874,
    total_hidden_gems: 127,
    total_elite: 89,
    total_anomalies: 45,
    total_typical: 452,
  },
  {
    year: '2023-24',
    median_impact_score: 0.49,
    median_performance_score: 0.48,
    median_economic_need: 0.71,
    mean_impact_score: 0.49,
    mean_performance_score: 0.49,
    mean_economic_need: 0.69,
    total_schools: 1867,
    total_hidden_gems: 118,
    total_elite: 82,
    total_anomalies: 42,
    total_typical: 445,
  },
];

// ============================================================================
// School Locations
// ============================================================================

export const testLocations: SchoolLocation[] = [
  {
    dbn: '13K123',
    address: '123 Main Street',
    city: 'Brooklyn',
    state: 'NY',
    zip: '11201',
    building_code: 'K123',
    latitude: 40.6892,
    longitude: -73.9857,
    grades_served: 'PK-5',
    grades_final_text: 'PK,0K,01,02,03,04,05',
    location_category: 'Elementary',
    principal_name: 'Jane Smith',
    phone: '718-555-0100',
    nta: 'Downtown Brooklyn',
    council_district: 33,
    open_date: '1985-09-01',
    managed_by: 'DOE',
  },
  {
    dbn: '02M475',
    address: '345 Chambers Street',
    city: 'New York',
    state: 'NY',
    zip: '10282',
    building_code: 'M475',
    latitude: 40.7177,
    longitude: -74.0135,
    grades_served: '9-12',
    grades_final_text: '09,10,11,12',
    location_category: 'High School',
    principal_name: 'John Doe',
    phone: '212-555-0200',
    nta: 'Battery Park City-Lower Manhattan',
    council_district: 1,
    open_date: '1904-09-01',
    managed_by: 'DOE',
  },
];

// ============================================================================
// School Budgets
// ============================================================================

export const testBudgets: SchoolBudget[] = [
  {
    dbn: '13K123',
    year: '2024-25',
    school_type: 'Elementary',
    total_budget_allocation: 5500000,
    total_fsf_allocation: 4200000,
    pct_funded: 0.92,
    gap_to_100_pct: 350000,
    foundation_amount: 3800000,
    collective_bargaining: 400000,
    fsf_as_pct_of_total: 0.76,
    non_fsf_allocations: 1300000,
  },
  {
    dbn: '13K123',
    year: '2023-24',
    school_type: 'Elementary',
    total_budget_allocation: 5200000,
    total_fsf_allocation: 4000000,
    pct_funded: 0.90,
    gap_to_100_pct: 400000,
    foundation_amount: 3600000,
    collective_bargaining: 400000,
    fsf_as_pct_of_total: 0.77,
    non_fsf_allocations: 1200000,
  },
];

// ============================================================================
// School Suspensions
// ============================================================================

export const testSuspensions: SchoolSuspension[] = [
  {
    dbn: '13K123',
    year: '2024-25',
    removals: 5,
    principal_suspensions: 3,
    superintendent_suspensions: 1,
    total_suspensions: 9,
    is_redacted: false,
  },
  {
    dbn: '13K123',
    year: '2023-24',
    removals: null,
    principal_suspensions: null,
    superintendent_suspensions: null,
    total_suspensions: null,
    is_redacted: true,
  },
];

// ============================================================================
// PTA Data
// ============================================================================

export const testPTAData: PTAData[] = [
  {
    id: 1,
    dbn: '13K123',
    year: '2024-25',
    beginning_balance: 15000,
    total_income: 45000,
    total_expenses: 42000,
    ending_balance: 18000,
  },
  {
    id: 2,
    dbn: '31R567',
    year: '2024-25',
    beginning_balance: 125000,
    total_income: 350000,
    total_expenses: 320000,
    ending_balance: 155000,
  },
];

// ============================================================================
// Persistent Gems (schools with high growth in both years)
// ============================================================================

export const testPersistentGems = [
  { dbn: '13K123' }, // High growth in both 2023-24 and 2024-25
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a test school by DBN
 */
export function getTestSchool(dbn: string): School | undefined {
  return testSchools.find(s => s.dbn === dbn);
}

/**
 * Get test metrics for a school
 */
export function getTestMetrics(dbn: string, year?: string): SchoolMetrics[] {
  const metrics = testMetrics.filter(m => m.dbn === dbn);
  if (year) {
    return metrics.filter(m => m.year === year);
  }
  return metrics;
}

/**
 * Get test schools by category
 */
export function getTestSchoolsByCategory(category: string): School[] {
  const dbns = testMetrics
    .filter(m => m.category === category && m.year === '2024-25')
    .map(m => m.dbn);
  return testSchools.filter(s => dbns.includes(s.dbn));
}

/**
 * Get test schools by borough
 */
export function getTestSchoolsByBorough(borough: string): School[] {
  return testSchools.filter(s => s.borough === borough);
}

/**
 * Get test schools by report type
 */
export function getTestSchoolsByReportType(reportType: string): School[] {
  return testSchools.filter(s => s.report_type === reportType);
}
