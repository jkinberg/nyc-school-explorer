-- NYC School Data Explorer - SQLite Schema
-- Version: 1.0
-- Last Updated: January 2026

-- Core school info (static across years)
CREATE TABLE IF NOT EXISTS schools (
  dbn TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  borough TEXT NOT NULL,
  district TEXT NOT NULL,
  school_type TEXT NOT NULL,      -- Elementary, Middle, K-8, High School, Transfer, D75
  report_type TEXT NOT NULL,      -- EMS, HS, HST, EC, D75
  is_charter BOOLEAN DEFAULT FALSE
);

-- Yearly metrics (one row per school per year)
CREATE TABLE IF NOT EXISTS school_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dbn TEXT NOT NULL,
  year TEXT NOT NULL,              -- "2023-24", "2024-25"

  -- Core scores (normalized 0-1)
  enrollment INTEGER,
  impact_score REAL,
  performance_score REAL,
  economic_need_index REAL,        -- Parsed from "> 95%" format

  -- Quality ratings
  rating_instruction TEXT,         -- Excellent, Good, Fair, Poor, N/A
  rating_safety TEXT,
  rating_families TEXT,

  -- Survey scores (% positive, 0-1)
  survey_instruction REAL,
  survey_safety REAL,
  survey_leadership REAL,
  survey_support REAL,
  survey_communication REAL,
  survey_family_involvement REAL,
  survey_family_trust REAL,

  -- Demographics
  pct_ell REAL,                   -- English Language Learners
  pct_iep REAL,                   -- Students with IEPs
  pct_temp_housing REAL,          -- Students in temporary housing
  pct_hra_eligible REAL,          -- HRA eligible

  -- Staff metrics
  principal_years INTEGER,
  pct_teachers_3plus_years REAL,
  student_attendance REAL,
  teacher_attendance REAL,

  -- Computed category (pre-computed during import)
  category TEXT,                   -- high_growth_high_achievement, high_growth, high_achievement, developing, below_threshold

  -- Category criteria stored as JSON for transparency
  category_criteria TEXT,

  UNIQUE(dbn, year),
  FOREIGN KEY (dbn) REFERENCES schools(dbn)
);

-- Persistent high growth schools (schools that were high-impact both years)
-- Table name kept as persistent_gems for backwards compatibility
CREATE TABLE IF NOT EXISTS persistent_gems (
  dbn TEXT PRIMARY KEY,
  FOREIGN KEY (dbn) REFERENCES schools(dbn)
);

-- PTA financial data (for context on resources)
CREATE TABLE IF NOT EXISTS pta_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dbn TEXT NOT NULL,
  year TEXT NOT NULL,
  beginning_balance REAL,
  total_income REAL,
  total_expenses REAL,
  ending_balance REAL,
  UNIQUE(dbn, year),
  FOREIGN KEY (dbn) REFERENCES schools(dbn)
);

-- School locations (from LCGMS + ShapePoints)
-- No foreign key: LCGMS contains schools not in SQR reports
CREATE TABLE IF NOT EXISTS school_locations (
  dbn TEXT PRIMARY KEY,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'NY',
  zip TEXT,
  building_code TEXT,
  latitude REAL,
  longitude REAL,
  grades_served TEXT,
  grades_final_text TEXT,
  location_category TEXT,
  principal_name TEXT,
  phone TEXT,
  nta TEXT,
  council_district INTEGER,
  open_date TEXT,
  managed_by TEXT
);

-- School budget data (LL16 reports)
-- No foreign key: budget reports may contain schools not in SQR data
CREATE TABLE IF NOT EXISTS school_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dbn TEXT NOT NULL,
  year TEXT NOT NULL,
  school_type TEXT,
  total_budget_allocation REAL,
  total_fsf_allocation REAL,
  pct_funded REAL,
  gap_to_100_pct REAL,
  foundation_amount REAL,
  collective_bargaining REAL,
  fsf_as_pct_of_total REAL,
  non_fsf_allocations REAL,
  UNIQUE(dbn, year)
);

-- School suspension data (LL93 reports)
-- No foreign key: suspension reports may contain schools not in SQR data
CREATE TABLE IF NOT EXISTS school_suspensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dbn TEXT NOT NULL,
  year TEXT NOT NULL,
  removals INTEGER,
  principal_suspensions INTEGER,
  superintendent_suspensions INTEGER,
  total_suspensions INTEGER,
  is_redacted BOOLEAN DEFAULT FALSE,
  UNIQUE(dbn, year)
);

-- Citywide statistics for context
CREATE TABLE IF NOT EXISTS citywide_stats (
  year TEXT PRIMARY KEY,
  median_impact_score REAL,
  median_performance_score REAL,
  median_economic_need REAL,
  mean_impact_score REAL,
  mean_performance_score REAL,
  mean_economic_need REAL,
  total_schools INTEGER,
  -- Column names kept for backwards compatibility; now store:
  -- total_hidden_gems → high_growth, total_elite → high_growth_high_achievement,
  -- total_anomalies → high_achievement, total_typical → developing
  total_hidden_gems INTEGER,
  total_elite INTEGER,
  total_anomalies INTEGER,
  total_typical INTEGER
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metrics_year ON school_metrics(year);
CREATE INDEX IF NOT EXISTS idx_metrics_category ON school_metrics(category, year);
CREATE INDEX IF NOT EXISTS idx_metrics_eni ON school_metrics(economic_need_index, year);
CREATE INDEX IF NOT EXISTS idx_metrics_impact ON school_metrics(impact_score, year);
CREATE INDEX IF NOT EXISTS idx_metrics_performance ON school_metrics(performance_score, year);
CREATE INDEX IF NOT EXISTS idx_schools_borough ON schools(borough);
CREATE INDEX IF NOT EXISTS idx_schools_type ON schools(school_type);
CREATE INDEX IF NOT EXISTS idx_schools_report_type ON schools(report_type);
CREATE INDEX IF NOT EXISTS idx_locations_building ON school_locations(building_code);
CREATE INDEX IF NOT EXISTS idx_locations_nta ON school_locations(nta);
CREATE INDEX IF NOT EXISTS idx_budgets_year ON school_budgets(year);
CREATE INDEX IF NOT EXISTS idx_suspensions_year ON school_suspensions(year);
