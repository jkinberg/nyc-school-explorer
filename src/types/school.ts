// Core school data (static across years)
export interface School {
  dbn: string;
  name: string;
  borough: string;
  district: string;
  school_type: string;
  report_type: 'EMS' | 'HS' | 'HST' | 'EC' | 'D75';
  is_charter: boolean;
}

// Yearly metrics for a school
export interface SchoolMetrics {
  id: number;
  dbn: string;
  year: string;

  // Core scores
  enrollment: number | null;
  impact_score: number | null;
  performance_score: number | null;
  economic_need_index: number | null;

  // Ratings
  rating_instruction: string | null;
  rating_safety: string | null;
  rating_families: string | null;

  // Survey scores (0-1)
  survey_instruction: number | null;
  survey_safety: number | null;
  survey_leadership: number | null;
  survey_support: number | null;
  survey_communication: number | null;
  survey_family_involvement: number | null;
  survey_family_trust: number | null;

  // Demographics
  pct_ell: number | null;
  pct_iep: number | null;
  pct_temp_housing: number | null;
  pct_hra_eligible: number | null;

  // Staff metrics
  principal_years: number | null;
  pct_teachers_3plus_years: number | null;
  student_attendance: number | null;
  teacher_attendance: number | null;

  // Computed
  category: SchoolCategory | null;
  category_criteria: string | null; // JSON
}

// Combined school + metrics
export interface SchoolWithMetrics extends School {
  year: string;
  enrollment: number | null;
  impact_score: number | null;
  performance_score: number | null;
  economic_need_index: number | null;
  rating_instruction?: string | null;
  rating_safety?: string | null;
  rating_families?: string | null;
  survey_instruction?: number | null;
  survey_safety?: number | null;
  survey_leadership?: number | null;
  survey_support?: number | null;
  survey_communication?: number | null;
  survey_family_involvement?: number | null;
  survey_family_trust?: number | null;
  student_attendance?: number | null;
  teacher_attendance?: number | null;
  principal_years?: number | null;
  pct_teachers_3plus_years?: number | null;
  category: SchoolCategory | null;
  category_criteria?: string | null;
}

// School categories based on Impact + Performance + ENI
// Note: Database still stores old values ('developing', 'below_threshold'). Map at query/response layer.
export type SchoolCategory = 'high_growth_high_achievement' | 'high_growth' | 'high_achievement' | 'below_growth_threshold' | 'lower_economic_need';

// Category thresholds
export const CATEGORY_THRESHOLDS = {
  impact_threshold: 0.55,      // >= for "high impact" (true top quartile)
  performance_threshold: 0.50, // >= for "high performance"
  eni_threshold: 0.85,         // >= for "high poverty"
} as const;

// Citywide statistics for context
export interface CitywideStat {
  year: string;
  median_impact_score: number;
  median_performance_score: number;
  median_economic_need: number;
  mean_impact_score: number;
  mean_performance_score: number;
  mean_economic_need: number;
  total_schools: number;
  // Note: column names kept for DB compatibility, now store:
  // total_hidden_gems → high_growth, total_elite → high_growth_high_achievement
  total_hidden_gems: number;
  total_elite: number;
  total_anomalies: number;
  total_typical: number;
}

// PTA financial data
export interface PTAData {
  id: number;
  dbn: string;
  year: string;
  beginning_balance: number | null;
  total_income: number | null;
  total_expenses: number | null;
  ending_balance: number | null;
}

// School location data (from LCGMS + ShapePoints)
export interface SchoolLocation {
  dbn: string;
  address: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  building_code: string | null;
  latitude: number | null;
  longitude: number | null;
  grades_served: string | null;
  grades_final_text: string | null;
  location_category: string | null;
  principal_name: string | null;
  phone: string | null;
  nta: string | null;
  council_district: number | null;
  open_date: string | null;
  managed_by: string | null;
}

// School budget data (LL16 reports)
export interface SchoolBudget {
  dbn: string;
  year: string;
  school_type: string | null;
  total_budget_allocation: number | null;
  total_fsf_allocation: number | null;
  pct_funded: number | null;
  gap_to_100_pct: number | null;
  foundation_amount: number | null;
  collective_bargaining: number | null;
  fsf_as_pct_of_total: number | null;
  non_fsf_allocations: number | null;
}

// School suspension data (LL93 reports)
export interface SchoolSuspension {
  dbn: string;
  year: string;
  removals: number | null;
  principal_suspensions: number | null;
  superintendent_suspensions: number | null;
  total_suspensions: number | null;
  is_redacted: boolean;
}

// Curated list types
export type CuratedListType = 'high_growth' | 'persistent_high_growth' | 'high_growth_high_achievement' | 'high_achievement' | 'all_high_impact';

export const CURATED_LIST_DESCRIPTIONS: Record<CuratedListType, string> = {
  high_growth: "Elementary/Middle Schools with strong student growth (Impact ≥ 0.55) despite lower absolute scores (Performance < 0.50), serving high-poverty populations (ENI ≥ 0.85). These schools produce exceptional learning gains that Performance Score alone would miss.",
  persistent_high_growth: "Elementary/Middle Schools that maintained strong growth status across both 2023-24 and 2024-25. Two years of consistency suggests something real, though we can't determine why.",
  high_growth_high_achievement: "Elementary/Middle Schools achieving both strong growth AND strong absolute outcomes while serving high-poverty populations. The dual success story.",
  high_achievement: "Rare cases among Elementary/Middle Schools: strong absolute scores but moderate growth. Students may arrive well-prepared.",
  all_high_impact: "All high-poverty Elementary/Middle Schools producing top-quartile student growth, regardless of absolute performance level."
};

// Tool response context (always included)
export interface ResponseContext {
  sample_size: number;
  data_year: string;
  citywide_medians: {
    impact: number;
    performance: number;
    eni: number;
  };
  limitations: string[];
  methodology_note?: string;
  value_range?: { min: number; max: number };
}

// Metric explanation content
export interface MetricExplanation {
  name: string;
  what_it_measures: string;
  how_calculated: string;
  limitations: string[];
  correlation_with_poverty: string;
  recommended_interpretation: string;
}

export const METRIC_EXPLANATIONS: Record<string, MetricExplanation> = {
  impact_score: {
    name: "Impact Score",
    what_it_measures: "Student growth relative to similar students citywide. A score of 0.60 means students at this school grew more than 60% of students with similar starting points.",
    how_calculated: "Uses a value-added model comparing actual growth to expected growth based on prior achievement and demographics. Exact methodology not fully disclosed by NYC DOE.",
    limitations: [
      "Only 2 years of data available (2023-24, 2024-25)",
      "Methodology details not fully public",
      "Cannot rule out selection effects (students leaving/entering)",
      "39% of high-impact schools don't maintain status year-over-year"
    ],
    correlation_with_poverty: "r = -0.29 (weaker than Performance Score)",
    recommended_interpretation: "Better indicator of teaching effectiveness than Performance Score, but still cannot prove causation. Use for pattern discovery, not definitive claims."
  },
  performance_score: {
    name: "Performance Score",
    what_it_measures: "Absolute student outcomes on standardized assessments. Reflects where students are, not how much they grew.",
    how_calculated: "Composite of test scores, graduation rates (for HS), and other outcome measures.",
    limitations: [
      "Correlates strongly with poverty (r = -0.69)",
      "Largely reflects what students bring to school, not just what schools provide",
      "Should never be used alone to judge school quality"
    ],
    correlation_with_poverty: "r = -0.69 (strong negative correlation)",
    recommended_interpretation: "Always present alongside Impact Score and Economic Need. A low Performance Score in a high-poverty school may mask excellent teaching."
  },
  economic_need_index: {
    name: "Economic Need Index (ENI)",
    what_it_measures: "Poverty level of the student population. Higher values = higher poverty.",
    how_calculated: "Based on temp housing status, HRA eligibility, and free/reduced lunch data.",
    limitations: [
      "Single composite may mask variation in specific challenges",
      "Does not capture all dimensions of disadvantage"
    ],
    correlation_with_poverty: "N/A (this IS the poverty measure)",
    recommended_interpretation: "Essential context for interpreting any other metric. A school with ENI 0.95 faces fundamentally different challenges than one with ENI 0.50."
  },
  high_growth_framework: {
    name: "High Growth Schools Framework",
    what_it_measures: "Elementary/Middle Schools producing exceptional student growth despite high poverty and lower absolute scores.",
    how_calculated: "Impact Score ≥ 0.55 AND Performance Score < 0.50 AND Economic Need ≥ 0.85 (EMS only)",
    limitations: [
      "Framework validated for Elementary/Middle Schools (EMS) only",
      "Counts are dynamic - query get_curated_lists for current numbers",
      "Cannot determine WHY these schools show high growth",
      "Multiple explanations possible: teaching quality, selection effects, measurement artifacts",
      "Many schools do not maintain category status year-over-year"
    ],
    correlation_with_poverty: "N/A",
    recommended_interpretation: "These schools are worth investigating but should not be assumed to be 'better.' Present as hypothesis-generating, not conclusive evidence. Always specify EMS scope when discussing."
  },
  budget_funding: {
    name: "School Budget & Fair Student Funding (FSF)",
    what_it_measures: "Total budget allocation, Fair Student Funding amount, and percentage of formula funding a school receives. FSF is the DOE's primary formula-based funding mechanism.",
    how_calculated: "From NYC DOE Local Law 16 annual budget reports. Total budget includes all allocations; FSF includes foundation + collective bargaining amounts; % funded = FSF received / FSF formula target.",
    limitations: [
      "Charter school budgets are not comparable to DOE-managed schools",
      "Budget data does not include grants, donations, or PTA contributions",
      "% funded below 100% means the school receives less than the formula target",
      "Budget allocation does not reflect actual spending or efficiency"
    ],
    correlation_with_poverty: "Higher-poverty schools may receive more per-pupil FSF funding by formula, but % funded varies",
    recommended_interpretation: "Use % funded to understand relative resource equity. A school at 90% funded receives 10% less than what the FSF formula says it should get. Do not compare charter and DOE budgets directly."
  },
  suspensions: {
    name: "Student Suspensions (LL93)",
    what_it_measures: "Number of removals, principal suspensions, and superintendent suspensions reported annually under Local Law 93.",
    how_calculated: "Aggregated from NYC DOE annual discipline reports. Includes removals (informal), principal suspensions (up to 5 days), and superintendent suspensions (6+ days). Values of 'R' indicate redacted small counts for privacy.",
    limitations: [
      "Redacted values ('R') indicate counts between 1-5 but exact number is hidden",
      "Suspension rates correlate with poverty and systemic bias",
      "Does not capture in-school discipline, restorative practices, or informal removals",
      "Schools may differ in reporting practices",
      "Lower suspensions may indicate better culture OR under-reporting"
    ],
    correlation_with_poverty: "Higher-poverty schools tend to have higher suspension rates, reflecting systemic patterns rather than individual school quality",
    recommended_interpretation: "Never label a school as 'unsafe' based on suspension counts alone. Always contextualize with ENI and school size. Redacted values indicate small counts. Suspension data reflects systemic patterns as much as individual school decisions."
  },
  pta_finances: {
    name: "PTA Financial Data",
    what_it_measures: "Parent-Teacher Association income, expenses, and balance. Reflects parent fundraising capacity.",
    how_calculated: "From NYC DOE PTA financial reporting. Includes beginning balance, total income (dues, fundraising, donations), total expenses, and ending balance.",
    limitations: [
      "PTA income primarily reflects parent wealth, not school quality",
      "Some schools have very active PTAs that raise millions; others raise very little",
      "Does not account for corporate sponsors or external grants",
      "Not all schools have active PTAs or report data"
    ],
    correlation_with_poverty: "Strong negative correlation — wealthier communities raise significantly more PTA funds",
    recommended_interpretation: "PTA data provides context on community resources but should never be used to judge school quality. High PTA income indicates affluent parent community, not better teaching."
  },
  school_location: {
    name: "School Location Data",
    what_it_measures: "Physical address, building code, geographic coordinates, grades served, principal, and neighborhood (NTA) for each school.",
    how_calculated: "From LCGMS (Location Code Management System) and DOE ShapePoint geographic data files.",
    limitations: [
      "Co-located schools share the same building code and address",
      "Geographic coordinates are building-level, not entrance-level",
      "NTA (Neighborhood Tabulation Area) boundaries are defined by NYC DCP and may not match common neighborhood names"
    ],
    correlation_with_poverty: "N/A (geographic data)",
    recommended_interpretation: "Use location data for geographic context. Building code identifies co-located schools sharing a facility. NTA provides neighborhood-level context."
  }
};
