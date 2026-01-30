/**
 * NYC School Data Pipeline
 *
 * Parses Excel files from NYC DOE School Quality Reports and populates SQLite database.
 *
 * Usage:
 *   npx tsx scripts/seed-database.ts
 *
 * Data sources:
 *   - School Quality Reports (EMS, HS, HST, EC, D75) for 2022-23, 2023-24, and 2024-25
 *     Note: 2022-23 does not include Impact/Performance scores (added in 2023-24)
 *   - PTA Financial Reporting (2022-23, 2023-24, 2024-25)
 *   - LCGMS School Location Data + ShapePoints (lat/long)
 *   - LL16 Budget Reports (2022-23, 2023-24, 2024-25)
 *   - LL93 Suspension Reports (2022-23, 2023-24, 2024-25)
 */

import * as XLSX from 'xlsx';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { DBFFile } from 'dbffile';

// Configuration
const DATA_DIR = path.join(__dirname, '..', '..', 'data-samples', 'raw');
const DB_PATH = path.join(__dirname, '..', 'data', 'schools.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'lib', 'db', 'schema.sql');

// Category thresholds
const THRESHOLDS = {
  impact: 0.55,      // Was 0.60 → now true top quartile (~25%)
  performance: 0.50, // Unchanged (already ~25%)
  eni: 0.85,         // Unchanged
};

// Report type configurations
interface ReportConfig {
  file: string;
  year: string;
  type: 'EMS' | 'HS' | 'HST' | 'EC' | 'D75';
}

const REPORT_FILES: ReportConfig[] = [
  // 2024-25
  { file: '202425-ems-sqr-results.xlsx', year: '2024-25', type: 'EMS' },
  { file: '202425-hs-sqr-results.xlsx', year: '2024-25', type: 'HS' },
  { file: '202425-hst-sqr-results.xlsx', year: '2024-25', type: 'HST' },
  { file: '202425-ec-sqr-results.xlsx', year: '2024-25', type: 'EC' },
  { file: '202425-d75-sqr-results.xlsx', year: '2024-25', type: 'D75' },
  // 2023-24
  { file: '202324-ems-sqr-results.xlsx', year: '2023-24', type: 'EMS' },
  { file: '202324-hs-sqr-results.xlsx', year: '2023-24', type: 'HS' },
  { file: '202324-hst-sqr-results.xlsx', year: '2023-24', type: 'HST' },
  { file: '202324-ec-sqr-results.xlsx', year: '2023-24', type: 'EC' },
  { file: '202324-d75-sqr-results.xlsx', year: '2023-24', type: 'D75' },
  // 2022-23 (no Impact/Performance scores - added in 2023-24)
  { file: '202223-ems-sqr-results.xlsx', year: '2022-23', type: 'EMS' },
  { file: '202223-hs-sqr-results.xlsx', year: '2022-23', type: 'HS' },
  { file: '202223-hst-sqr-results.xlsx', year: '2022-23', type: 'HST' },
  { file: '202223-ec-sqr-results.xlsx', year: '2022-23', type: 'EC' },
  { file: '202223-d75-sqr-results.xlsx', year: '2022-23', type: 'D75' },
];

const PTA_FILES = [
  { file: '2024-25-pta-financial-reporting.xlsx', year: '2024-25' },
  { file: '2023-24-pta-financial-reporting.xlsx', year: '2023-24' },
  { file: '2022-23-pta-financial-reporting.xlsx', year: '2022-23' },
];

interface BudgetConfig {
  file: string;
  year: string;
  sheet: string;
  dbnColumn: string;
  range?: number;
}

const BUDGET_FILES: BudgetConfig[] = [
  { file: 'sy-2022-2023-report.xlsx', year: '2022-23', sheet: 'FY 23 LL 16_Full Rpt', dbnColumn: 'DBN' },
  { file: 'sy-2023-2024-report.xlsx', year: '2023-24', sheet: 'FY 24 LL 16_Full Rpt', dbnColumn: 'dbn' },
  { file: 'sy-2024-2025-report.xlsx', year: '2024-25', sheet: 'LL16', dbnColumn: 'School Code', range: 1 },
];

interface SuspensionConfig {
  file: string;
  year: string;
  sheet: string;
  dbnColumn: string;
}

const SUSPENSION_FILES: SuspensionConfig[] = [
  { file: '09272023-ll93-annual-report-on-student-discipline--section-c-mf-redacted-final.xlsx', year: '2022-23', sheet: 'Annual Report--R-P-S TOTALS', dbnColumn: 'System_Code' },
  { file: 'student-discipline---annual-report-on-student-discipline-2023-24435e836e-d776-452c-b9a7-b655d1675be9.xlsx', year: '2023-24', sheet: 'Annual Report--R-P-S TOTALS', dbnColumn: 'SchoolDBN' },
  { file: '10142025-ll93-annual-report-on-student-discipline-dl.xlsx', year: '2024-25', sheet: 'Annual Report --R-P-S TOTALS', dbnColumn: 'SchoolDBN' },
];

// Column mapping - maps various Excel column names to our schema
const COLUMN_MAP: Record<string, string> = {
  // DBN variants
  'dbn': 'dbn',
  'DBN': 'dbn',
  'school dbn': 'dbn',
  'School DBN': 'dbn',

  // Name variants
  'school name': 'name',
  'School Name': 'name',
  'name': 'name',

  // Borough variants
  'borough': 'borough',
  'Borough': 'borough',

  // District variants
  'district': 'district',
  'District': 'district',

  // Scores
  'impact score': 'impact_score',
  'Impact Score': 'impact_score',
  'student achievement - impact': 'impact_score',
  'Student Achievement - Impact': 'impact_score',

  'performance score': 'performance_score',
  'Performance Score': 'performance_score',
  'student achievement - performance': 'performance_score',
  'Student Achievement - Performance': 'performance_score',

  // ENI
  'economic need index': 'economic_need_index',
  'Economic Need Index': 'economic_need_index',
  'eni': 'economic_need_index',
  'ENI': 'economic_need_index',

  // Enrollment
  'enrollment': 'enrollment',
  'Enrollment': 'enrollment',
  'total enrollment': 'enrollment',
  'Total Enrollment': 'enrollment',

  // Ratings
  'rigorous instruction rating': 'rating_instruction',
  'Rigorous Instruction Rating': 'rating_instruction',
  'supportive environment rating': 'rating_safety',
  'Supportive Environment Rating': 'rating_safety',
  'strong family-community ties rating': 'rating_families',
  'Strong Family-Community Ties Rating': 'rating_families',

  // Survey scores
  // Survey columns - 2022-23 naming
  'rigorous instruction - percent positive': 'survey_instruction',
  'Rigorous Instruction - Percent Positive': 'survey_instruction',
  'supportive environment - percent positive': 'survey_safety',
  'Supportive Environment - Percent Positive': 'survey_safety',
  'collaborative teachers - percent positive': 'survey_leadership',
  'Collaborative Teachers - Percent Positive': 'survey_leadership',
  'trust - percent positive': 'survey_support',
  'Trust - Percent Positive': 'survey_support',
  'effective school leadership - percent positive': 'survey_communication',
  'Effective School Leadership - Percent Positive': 'survey_communication',
  // Survey columns - 2023-24+ naming
  'Instruction/Learning Environment - School Percent Positive': 'survey_instruction',
  'Safety - School Percent Positive': 'survey_safety',
  'School Leadership - School Percent Positive': 'survey_leadership',
  'Student Support - School Percent Positive': 'survey_support',
  'Communication - School Percent Positive': 'survey_communication',
  'Family Involvement - School Percent Positive': 'survey_family_involvement',
  'Family-School Trust - School Percent Positive': 'survey_family_trust',

  // Demographics
  'percent ell': 'pct_ell',
  'Percent ELL': 'pct_ell',
  '% english language learners': 'pct_ell',
  'percent students with disabilities': 'pct_iep',
  'Percent Students with Disabilities': 'pct_iep',
  '% students with disabilities': 'pct_iep',
  'percent in temporary housing': 'pct_temp_housing',
  'Percent in Temporary Housing': 'pct_temp_housing',
  '% in temp housing': 'pct_temp_housing',
  'percent hra eligible': 'pct_hra_eligible',
  'Percent HRA Eligible': 'pct_hra_eligible',

  // Staff
  'principal experience at this school': 'principal_years',
  'Principal Experience at this School': 'principal_years',
  'years principal': 'principal_years',
  'Years of principal experience at this school': 'principal_years',
  'percent of teachers with 3 or more years of experience': 'pct_teachers_3plus_years',
  'Percent of Teachers with 3 or More Years of Experience': 'pct_teachers_3plus_years',
  'Percent of teachers with 3 or more years of experience': 'pct_teachers_3plus_years',
  '% teachers 3+ years': 'pct_teachers_3plus_years',

  // Attendance
  'student attendance rate': 'student_attendance',
  'Student Attendance Rate': 'student_attendance',
  'average student attendance': 'student_attendance',
  'Average Student Attendance': 'student_attendance',
  'teacher attendance rate': 'teacher_attendance',
  'Teacher Attendance Rate': 'teacher_attendance',
};

// Helper functions
function parsePercentage(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === 'N/A' || value === 'N<5') {
    return null;
  }

  const str = String(value).trim();

  // Handle "> 95%" format
  if (str.startsWith('>')) {
    const num = parseFloat(str.replace(/[>%\s]/g, ''));
    return isNaN(num) ? null : num / 100;
  }

  // Handle "< 5%" format
  if (str.startsWith('<')) {
    const num = parseFloat(str.replace(/[<%\s]/g, ''));
    return isNaN(num) ? null : num / 100;
  }

  // Handle regular percentage
  const num = parseFloat(str.replace(/[%\s]/g, ''));
  if (isNaN(num)) return null;

  // If the value is > 1, assume it's a percentage that needs dividing
  return num > 1 ? num / 100 : num;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === 'N/A' || value === 'N<5') {
    return null;
  }
  const num = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

function parseScore(value: unknown): number | null {
  const num = parseNumber(value);
  if (num === null) return null;
  // Scores are typically 0-1, but DOE scores can slightly exceed 1.0 for top schools (e.g., 1.07)
  // Only divide by 100 if the value is clearly a percentage (> 2)
  return num > 2 ? num / 100 : num;
}

function extractBorough(dbn: string): string {
  if (!dbn || dbn.length < 3) return 'Unknown';
  const boroughCode = dbn.charAt(2);
  const boroughMap: Record<string, string> = {
    'M': 'Manhattan',
    'X': 'Bronx',
    'K': 'Brooklyn',
    'Q': 'Queens',
    'R': 'Staten Island',
  };
  return boroughMap[boroughCode] || 'Unknown';
}

function extractDistrict(dbn: string): string {
  if (!dbn || dbn.length < 2) return '00';
  return dbn.substring(0, 2);
}

function determineSchoolType(reportType: string, name: string): string {
  const lowerName = name.toLowerCase();
  if (reportType === 'EC') return 'Early Childhood';
  if (reportType === 'D75') return 'D75';
  if (reportType === 'HST') return 'Transfer';
  if (reportType === 'HS') return 'High School';

  // For EMS, try to determine from name
  if (lowerName.includes('p.s.') || lowerName.includes('elementary')) return 'Elementary';
  if (lowerName.includes('m.s.') || lowerName.includes('middle')) return 'Middle';
  if (lowerName.includes('i.s.')) return 'Intermediate';
  if (lowerName.includes('k-8') || lowerName.includes('k-12')) return 'K-8';

  return 'Elementary/Middle';
}

function isCharter(name: string): boolean {
  const lowerName = name.toLowerCase();
  return lowerName.includes('charter') ||
         lowerName.includes('kipp') ||
         lowerName.includes('success academy');
}

function computeCategory(impactScore: number | null, performanceScore: number | null, eni: number | null): string {
  // Only categorize high-poverty schools
  if (eni === null || eni < THRESHOLDS.eni) {
    return 'below_threshold';
  }

  const highImpact = impactScore !== null && impactScore >= THRESHOLDS.impact;
  const highPerformance = performanceScore !== null && performanceScore >= THRESHOLDS.performance;

  if (highImpact && highPerformance) return 'high_growth_high_achievement';
  if (highImpact && !highPerformance) return 'high_growth';
  if (!highImpact && highPerformance) return 'high_achievement';
  return 'developing';
}

/**
 * Parse a suspension cell value that may be numeric or "R" (redacted).
 */
function parseSuspensionValue(value: unknown): { count: number | null; isRedacted: boolean } {
  if (value === null || value === undefined || value === '') {
    return { count: null, isRedacted: false };
  }
  const str = String(value).trim();
  if (str === 'R' || str === 'r') {
    return { count: null, isRedacted: true };
  }
  const num = parseFloat(str);
  if (isNaN(num)) {
    return { count: null, isRedacted: false };
  }
  return { count: Math.round(num), isRedacted: false };
}

/**
 * Find a column value from a row using case-insensitive matching with multiple possible names.
 * Also handles columns with whitespace/newline variations.
 */
function findColumn(row: Record<string, unknown>, possibleNames: string[]): unknown {
  for (const name of possibleNames) {
    if (row[name] !== undefined) return row[name];
  }
  // Fallback: try case-insensitive and whitespace-normalized matching
  const rowKeys = Object.keys(row);
  for (const name of possibleNames) {
    const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const key of rowKeys) {
      const normalizedKey = key.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalizedKey === normalized) return row[key];
    }
  }
  return undefined;
}

// Main pipeline
class DataPipeline {
  private db: Database.Database;
  private schoolsInserted = new Set<string>();

  constructor() {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Remove existing database
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }

    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  initializeSchema(): void {
    console.log('Initializing database schema...');
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    this.db.exec(schema);
  }

  parseExcelFile(config: ReportConfig): void {
    const filePath = path.join(DATA_DIR, 'School Quality Reports', config.file);

    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${config.file}`);
      return;
    }

    console.log(`Processing ${config.file}...`);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // 'Summary' sheet
    const worksheet = workbook.Sheets[sheetName];

    // These Excel files have headers on row 3 (0-indexed) and data starts at row 5
    // We need to parse manually from the cell values
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Find headers on row 3 (0-indexed)
    const headers: string[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 3, c });
      const cell = worksheet[cellAddr];
      headers[c] = cell ? String(cell.v).trim() : '';
    }

    // Find which columns we need
    // Note: Rating column names changed between 2022-23 and 2023-24+
    // We merge them into the same database columns for trend analysis:
    //   - "Rigorous Instruction Rating" (2022-23) → "Instruction and Performance - Rating" (2023-24+)
    //   - "Supportive Environment Rating" (2022-23) → "Safety and School Climate - Rating" (2023-24+)
    //   - "Strong Family-Community Ties Rating" (2022-23) → "Relationships with Families - Rating" (2023-24+)
    const colMap: Record<string, number> = {};
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (h === 'DBN') colMap['dbn'] = c;
      else if (h === 'School Name') colMap['name'] = c;
      else if (h === 'School Type') colMap['school_type'] = c;
      else if (h === 'Enrollment') colMap['enrollment'] = c;
      else if (h === 'Impact Score') colMap['impact_score'] = c;
      else if (h === 'Performance Score') colMap['performance_score'] = c;
      else if (h === 'Economic Need Index') colMap['economic_need_index'] = c;
      // Rating columns - handle both 2022-23 and 2023-24+ naming conventions
      else if (h === 'Rigorous Instruction Rating' || h === 'Instruction and Performance - Rating') colMap['rating_instruction'] = c;
      else if (h === 'Supportive Environment Rating' || h === 'Safety and School Climate - Rating') colMap['rating_safety'] = c;
      else if (h === 'Strong Family-Community Ties Rating' || h === 'Relationships with Families - Rating') colMap['rating_families'] = c;
      else if (h === 'Student Attendance Rate' || h === 'Average Student Attendance') colMap['student_attendance'] = c;
      else if (h === 'Teacher Attendance Rate') colMap['teacher_attendance'] = c;
      else if (h === 'Years Principal' || h === 'Years of principal experience at this school') colMap['principal_years'] = c;
      else if (h === 'Percent ELL' || h === 'Percent English Language Learners') colMap['pct_ell'] = c;
      else if (h === 'Percent Students with Disabilities' || h === 'Percent Students with IEPs') colMap['pct_iep'] = c;
      else if (h === 'Percent in Temporary Housing' || h === 'Percent in Temp Housing') colMap['pct_temp_housing'] = c;
      else if (h === 'Percent HRA Eligible') colMap['pct_hra_eligible'] = c;
      else if (h.includes('teachers with 3 or more years') || (h.includes('Teacher') && h.includes('3'))) colMap['pct_teachers_3plus_years'] = c;
      // Survey columns - 2022-23 naming
      else if (h === 'Rigorous Instruction - Percent Positive') colMap['survey_instruction'] = c;
      else if (h === 'Supportive Environment - Percent Positive') colMap['survey_safety'] = c;
      else if (h === 'Collaborative Teachers - Percent Positive') colMap['survey_leadership'] = c;
      else if (h === 'Trust - Percent Positive') colMap['survey_support'] = c;
      else if (h === 'Effective School Leadership - Percent Positive') colMap['survey_communication'] = c;
      // Survey columns - 2023-24+ naming
      else if (h === 'Instruction/Learning Environment - School Percent Positive') colMap['survey_instruction'] = c;
      else if (h === 'Safety - School Percent Positive') colMap['survey_safety'] = c;
      else if (h === 'School Leadership - School Percent Positive') colMap['survey_leadership'] = c;
      else if (h === 'Student Support - School Percent Positive') colMap['survey_support'] = c;
      else if (h === 'Communication - School Percent Positive') colMap['survey_communication'] = c;
      else if (h === 'Family Involvement - School Percent Positive') colMap['survey_family_involvement'] = c;
      else if (h === 'Family-School Trust - School Percent Positive') colMap['survey_family_trust'] = c;
    }

    // Parse data rows starting at row 5 (0-indexed)
    const data: Record<string, unknown>[] = [];
    for (let r = 5; r <= range.e.r; r++) {
      const row: Record<string, unknown> = {};
      for (const [field, col] of Object.entries(colMap)) {
        const cellAddr = XLSX.utils.encode_cell({ r, c: col });
        const cell = worksheet[cellAddr];
        row[field] = cell ? cell.v : null;
      }
      // Only add rows that have a DBN
      if (row.dbn && String(row.dbn).trim().length >= 4) {
        data.push(row);
      }
    }

    console.log(`  Found ${data.length} schools with data`);

    const insertSchool = this.db.prepare(`
      INSERT OR IGNORE INTO schools (dbn, name, borough, district, school_type, report_type, is_charter)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMetrics = this.db.prepare(`
      INSERT OR REPLACE INTO school_metrics (
        dbn, year, enrollment, impact_score, performance_score, economic_need_index,
        rating_instruction, rating_safety, rating_families,
        survey_instruction, survey_safety, survey_leadership, survey_support, survey_communication,
        survey_family_involvement, survey_family_trust,
        pct_ell, pct_iep, pct_temp_housing, pct_hra_eligible,
        principal_years, pct_teachers_3plus_years, student_attendance, teacher_attendance,
        category, category_criteria
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let processedCount = 0;

    for (const row of data) {
      // Data is already mapped from our custom parsing
      const mapped = row;

      const dbn = String(mapped.dbn || '').trim();
      if (!dbn || dbn.length < 4) continue;

      const name = String(mapped.name || '').trim();
      if (!name) continue;

      // Use school_type from Excel if available, otherwise determine from name
      const schoolTypeFromExcel = String(mapped.school_type || '').trim();

      // Insert school if not already inserted
      if (!this.schoolsInserted.has(dbn)) {
        const finalSchoolType = schoolTypeFromExcel || determineSchoolType(config.type, name);
        insertSchool.run(
          dbn,
          name,
          extractBorough(dbn),
          extractDistrict(dbn),
          finalSchoolType,
          config.type,
          isCharter(name) ? 1 : 0
        );
        this.schoolsInserted.add(dbn);
      }

      // Parse metrics
      const impactScore = parseScore(mapped.impact_score);
      const performanceScore = parseScore(mapped.performance_score);
      const eni = parsePercentage(mapped.economic_need_index);
      const category = computeCategory(impactScore, performanceScore, eni);

      const categoryCriteria = JSON.stringify({
        impact_score: impactScore,
        performance_score: performanceScore,
        eni: eni,
        thresholds: THRESHOLDS,
        computed_at: new Date().toISOString(),
      });

      insertMetrics.run(
        dbn,
        config.year,
        parseNumber(mapped.enrollment),
        impactScore,
        performanceScore,
        eni,
        mapped.rating_instruction || null,
        mapped.rating_safety || null,
        mapped.rating_families || null,
        parsePercentage(mapped.survey_instruction),
        parsePercentage(mapped.survey_safety),
        parsePercentage(mapped.survey_leadership),
        parsePercentage(mapped.survey_support),
        parsePercentage(mapped.survey_communication),
        parsePercentage(mapped.survey_family_involvement),
        parsePercentage(mapped.survey_family_trust),
        parsePercentage(mapped.pct_ell),
        parsePercentage(mapped.pct_iep),
        parsePercentage(mapped.pct_temp_housing),
        parsePercentage(mapped.pct_hra_eligible),
        parseNumber(mapped.principal_years),
        parsePercentage(mapped.pct_teachers_3plus_years),
        parsePercentage(mapped.student_attendance),
        parsePercentage(mapped.teacher_attendance),
        category,
        categoryCriteria
      );

      processedCount++;
    }

    console.log(`  Processed ${processedCount} schools`);
  }

  parsePTAFiles(): void {
    const insertPTA = this.db.prepare(`
      INSERT OR REPLACE INTO pta_data (dbn, year, beginning_balance, total_income, total_expenses, ending_balance)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const ptaFile of PTA_FILES) {
      const filePath = path.join(DATA_DIR, 'PTA', ptaFile.file);

      if (!fs.existsSync(filePath)) {
        console.warn(`PTA file not found: ${ptaFile.file}`);
        continue;
      }

      console.log(`Processing PTA file: ${ptaFile.file}...`);

      const workbook = XLSX.readFile(filePath);
      // PTA files have a 'School' sheet with the data we need
      const worksheet = workbook.Sheets['School'];
      if (!worksheet) {
        console.warn(`  No 'School' sheet found in ${ptaFile.file}`);
        continue;
      }

      // Parse with headers on row 0
      const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

      let count = 0;
      for (const row of data) {
        const dbn = String(row['DBN'] || '').trim();
        if (!dbn || dbn.length < 4) continue;

        // Only insert if school exists in our database
        if (!this.schoolsInserted.has(dbn)) continue;

        const beginningBalance = parseNumber(row['Beginning Balance']);
        const income = parseNumber(row['Total Income']);
        const expenses = parseNumber(row['Total Expenses']);
        const balance = parseNumber(row['Ending Balance']);

        // Only insert if there's some financial data
        if (beginningBalance !== null || income !== null || expenses !== null || balance !== null) {
          insertPTA.run(dbn, ptaFile.year, beginningBalance, income, expenses, balance);
          count++;
        }
      }

      console.log(`  Processed ${count} PTA records`);
    }
  }

  parseLCGMSFile(): void {
    const filePath = path.join(DATA_DIR, 'Locations', 'LCGMS_SchoolData_20260123_1208.xls');

    if (!fs.existsSync(filePath)) {
      console.warn('LCGMS file not found');
      return;
    }

    console.log('Processing LCGMS location data...');

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    const insertLocation = this.db.prepare(`
      INSERT OR REPLACE INTO school_locations (
        dbn, address, city, state, zip, building_code,
        grades_served, grades_final_text, location_category,
        principal_name, phone, nta, council_district,
        open_date, managed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    for (const row of data) {
      const dbn = String(row['ATS System Code'] || '').trim();
      if (!dbn || dbn.length < 4) continue;

      // Only include Open schools
      const status = String(row['Status Description'] || '').trim();
      if (status !== 'Open') continue;

      const address = String(row['Primary Address'] || '').trim() || null;
      const city = String(row['City'] || '').trim() || null;
      const state = String(row['State Code'] || 'NY').trim();
      const zip = row['Zip'] ? String(row['Zip']).trim() : null;
      const buildingCode = String(row['Building Code'] || '').trim() || null;
      const gradesServed = String(row['Grades'] || '').trim() || null;
      const gradesFinalText = String(row['Grades Final'] || '').trim() || null;
      const locationCategory = String(row['Location Category Description'] || '').trim() || null;
      const principalName = String(row['Principal Name'] || '').trim() || null;
      const phone = String(row['Principal Phone Number'] || '').trim() || null;
      const nta = String(row['NTA_Name'] || '').trim() || null;
      const councilDistrict = row['Council District'] ? Number(row['Council District']) : null;
      const managedBy = String(row['Managed By Name'] || '').trim() || null;

      // Parse open date from Excel serial number
      let openDate: string | null = null;
      if (row['Open Date'] && typeof row['Open Date'] === 'number') {
        const date = XLSX.SSF.parse_date_code(row['Open Date'] as number);
        if (date) {
          openDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
      }

      insertLocation.run(
        dbn, address, city, state, zip, buildingCode,
        gradesServed, gradesFinalText, locationCategory,
        principalName, phone, nta, councilDistrict,
        openDate, managedBy
      );
      count++;
    }

    console.log(`  Processed ${count} location records`);
  }

  async parseShapePoints(): Promise<void> {
    const filePath = path.join(DATA_DIR, 'Locations', 'SchoolPoints_APS_2024_08_28', 'SchoolPoints_APS_2024_08_28.dbf');

    if (!fs.existsSync(filePath)) {
      console.warn('ShapePoints DBF file not found');
      return;
    }

    console.log('Processing ShapePoints for lat/long coordinates...');

    const dbf = await DBFFile.open(filePath);
    const records = await dbf.readRecords(dbf.recordCount);

    const updateCoords = this.db.prepare(`
      UPDATE school_locations SET latitude = ?, longitude = ? WHERE dbn = ?
    `);

    const insertWithCoords = this.db.prepare(`
      INSERT OR IGNORE INTO school_locations (dbn, latitude, longitude) VALUES (?, ?, ?)
    `);

    let updated = 0;
    let inserted = 0;
    for (const rec of records) {
      const dbn = String(rec['ATS'] || '').trim();
      if (!dbn || dbn.length < 4) continue;

      const lat = rec['Latitude'] as number;
      const lng = rec['Longitude'] as number;
      if (!lat || !lng) continue;

      // Try update first (location already exists from LCGMS)
      const result = updateCoords.run(lat, lng, dbn);
      if (result.changes > 0) {
        updated++;
      } else {
        // Insert new record with just coordinates
        insertWithCoords.run(dbn, lat, lng);
        inserted++;
      }
    }

    console.log(`  Updated ${updated} locations with coordinates, inserted ${inserted} new`);
  }

  parseBudgetFiles(): void {
    const insertBudget = this.db.prepare(`
      INSERT OR REPLACE INTO school_budgets (
        dbn, year, school_type, total_budget_allocation, total_fsf_allocation,
        pct_funded, gap_to_100_pct, foundation_amount, collective_bargaining,
        fsf_as_pct_of_total, non_fsf_allocations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const budgetFile of BUDGET_FILES) {
      const filePath = path.join(DATA_DIR, 'Budgets', budgetFile.file);

      if (!fs.existsSync(filePath)) {
        console.warn(`Budget file not found: ${budgetFile.file}`);
        continue;
      }

      console.log(`Processing budget file: ${budgetFile.file}...`);

      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[budgetFile.sheet];
      if (!worksheet) {
        console.warn(`  Sheet '${budgetFile.sheet}' not found in ${budgetFile.file}`);
        continue;
      }

      const parseOptions: XLSX.Sheet2JSONOpts = {};
      if (budgetFile.range !== undefined) {
        parseOptions.range = budgetFile.range;
      }

      const data = XLSX.utils.sheet_to_json(worksheet, parseOptions) as Record<string, unknown>[];

      let count = 0;
      for (const row of data) {
        const dbn = String(row[budgetFile.dbnColumn] || '').trim();
        if (!dbn || dbn.length < 4) continue;

        const schoolType = findColumn(row, ['School Type']) as string | undefined;
        const totalBudget = parseNumber(findColumn(row, ['Total Budget Allocation']));
        const totalFSF = parseNumber(findColumn(row, [
          'Total FSF Allocation Including Foundation and Collective Bargaining Costs'
        ]));
        const pctFunded = parseNumber(findColumn(row, ['% Funded']));
        const gap = parseNumber(findColumn(row, [
          'Weighted Register Allocation Gap to 100%'
        ]));
        const foundation = parseNumber(findColumn(row, [
          'Foundation (not included in the funding %)',
          'Foundation \r\n(not included in the funding %)'
        ]));
        const collectiveBargaining = parseNumber(findColumn(row, [
          'Collective Bargaining for School Based Staff (not included in the funding %)'
        ]));
        const fsfPct = parseNumber(findColumn(row, ['FSF as % of Total Budget Allocation']));
        const nonFSF = parseNumber(findColumn(row, ['Non-FSF Budget Allocations']));

        if (totalBudget !== null || totalFSF !== null) {
          insertBudget.run(
            dbn,
            budgetFile.year,
            schoolType ? String(schoolType).trim() : null,
            totalBudget,
            totalFSF,
            pctFunded,
            gap,
            foundation,
            collectiveBargaining,
            fsfPct,
            nonFSF
          );
          count++;
        }
      }

      console.log(`  Processed ${count} budget records`);
    }
  }

  parseSuspensionFiles(): void {
    const insertSuspension = this.db.prepare(`
      INSERT OR REPLACE INTO school_suspensions (
        dbn, year, removals, principal_suspensions, superintendent_suspensions,
        total_suspensions, is_redacted
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const suspFile of SUSPENSION_FILES) {
      const filePath = path.join(DATA_DIR, 'Suspensions', suspFile.file);

      if (!fs.existsSync(filePath)) {
        console.warn(`Suspension file not found: ${suspFile.file}`);
        continue;
      }

      console.log(`Processing suspension file: ${suspFile.file}...`);

      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[suspFile.sheet];
      if (!worksheet) {
        // Try fuzzy match for sheet names with spacing variations
        const matchingSheet = workbook.SheetNames.find(
          s => s.replace(/\s+/g, ' ').trim().toLowerCase().includes('r-p-s totals')
        );
        if (matchingSheet) {
          console.log(`  Using sheet '${matchingSheet}' (fuzzy match)`);
          const ws = workbook.Sheets[matchingSheet];
          this._parseSuspensionSheet(ws, suspFile, insertSuspension);
        } else {
          console.warn(`  Sheet '${suspFile.sheet}' not found in ${suspFile.file}`);
          console.warn(`  Available sheets: ${workbook.SheetNames.join(', ')}`);
        }
        continue;
      }

      this._parseSuspensionSheet(worksheet, suspFile, insertSuspension);
    }
  }

  private _parseSuspensionSheet(
    worksheet: XLSX.WorkSheet,
    suspFile: SuspensionConfig,
    insertSuspension: Database.Statement
  ): void {
    const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    let count = 0;
    let redactedCount = 0;
    for (const row of data) {
      const dbn = String(row[suspFile.dbnColumn] || '').trim();
      if (!dbn || dbn.length < 4) continue;

      const removal = parseSuspensionValue(row['REMOVAL']);
      const principal = parseSuspensionValue(row['PRINCIPAL']);
      const superintendent = parseSuspensionValue(row['SUPERINTENDENT']);
      const total = parseSuspensionValue(findColumn(row, ['TOTAL REMOVALS/SUSPENSIONS']));

      const anyRedacted = removal.isRedacted || principal.isRedacted ||
                         superintendent.isRedacted || total.isRedacted;

      if (anyRedacted) redactedCount++;

      insertSuspension.run(
        dbn,
        suspFile.year,
        removal.count,
        principal.count,
        superintendent.count,
        total.count,
        anyRedacted ? 1 : 0
      );
      count++;
    }

    console.log(`  Processed ${count} suspension records (${redactedCount} with redacted values)`);
  }

  computePersistentGems(): void {
    console.log('Computing persistent high growth schools...');

    // Find schools that were high-impact in BOTH years
    const sql = `
      INSERT INTO persistent_gems (dbn)
      SELECT m1.dbn
      FROM school_metrics m1
      JOIN school_metrics m2 ON m1.dbn = m2.dbn
      WHERE m1.year = '2023-24'
        AND m2.year = '2024-25'
        AND m1.category IN ('high_growth_high_achievement', 'high_growth')
        AND m2.category IN ('high_growth_high_achievement', 'high_growth')
    `;

    const result = this.db.prepare(sql).run();
    console.log(`  Found ${result.changes} persistent high growth schools`);
  }

  computeCitywideStats(): void {
    console.log('Computing citywide statistics...');

    const years = ['2022-23', '2023-24', '2024-25'];

    const insertStats = this.db.prepare(`
      INSERT OR REPLACE INTO citywide_stats (
        year, median_impact_score, median_performance_score, median_economic_need,
        mean_impact_score, mean_performance_score, mean_economic_need,
        total_schools, total_hidden_gems, total_elite, total_anomalies, total_typical
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Note: column names kept for backwards compatibility but now store:
    // total_hidden_gems → high_growth, total_elite → high_growth_high_achievement,
    // total_anomalies → high_achievement, total_typical → developing

    for (const year of years) {
      // Calculate medians (using approximate method via sorted data)
      const scores = this.db.prepare(`
        SELECT impact_score, performance_score, economic_need_index
        FROM school_metrics
        WHERE year = ?
          AND impact_score IS NOT NULL
          AND performance_score IS NOT NULL
          AND economic_need_index IS NOT NULL
        ORDER BY impact_score
      `).all(year) as { impact_score: number; performance_score: number; economic_need_index: number }[];

      if (scores.length === 0) continue;

      const mid = Math.floor(scores.length / 2);
      const sortedImpact = [...scores].sort((a, b) => a.impact_score - b.impact_score);
      const sortedPerf = [...scores].sort((a, b) => a.performance_score - b.performance_score);
      const sortedEni = [...scores].sort((a, b) => a.economic_need_index - b.economic_need_index);

      const medianImpact = sortedImpact[mid].impact_score;
      const medianPerf = sortedPerf[mid].performance_score;
      const medianEni = sortedEni[mid].economic_need_index;

      // Calculate means
      const means = this.db.prepare(`
        SELECT
          AVG(impact_score) as mean_impact,
          AVG(performance_score) as mean_perf,
          AVG(economic_need_index) as mean_eni,
          COUNT(*) as total
        FROM school_metrics
        WHERE year = ?
          AND impact_score IS NOT NULL
      `).get(year) as { mean_impact: number; mean_perf: number; mean_eni: number; total: number };

      // Count categories
      const categories = this.db.prepare(`
        SELECT category, COUNT(*) as count
        FROM school_metrics
        WHERE year = ?
        GROUP BY category
      `).all(year) as { category: string; count: number }[];

      const categoryMap = new Map(categories.map(c => [c.category, c.count]));

      insertStats.run(
        year,
        medianImpact,
        medianPerf,
        medianEni,
        means.mean_impact,
        means.mean_perf,
        means.mean_eni,
        means.total,
        categoryMap.get('high_growth') || 0,
        categoryMap.get('high_growth_high_achievement') || 0,
        categoryMap.get('high_achievement') || 0,
        categoryMap.get('developing') || 0
      );

      console.log(`  ${year}: ${means.total} schools, ${categoryMap.get('high_growth') || 0} high growth schools`);
    }
  }

  printSummary(): void {
    console.log('\n=== Database Summary ===\n');

    const schoolCount = this.db.prepare('SELECT COUNT(*) as count FROM schools').get() as { count: number };
    console.log(`Total schools: ${schoolCount.count}`);

    const metricsCount = this.db.prepare('SELECT COUNT(*) as count FROM school_metrics').get() as { count: number };
    console.log(`Total metric records: ${metricsCount.count}`);

    const byYear = this.db.prepare(`
      SELECT year, COUNT(*) as count
      FROM school_metrics
      GROUP BY year
    `).all() as { year: string; count: number }[];
    console.log('\nBy year:');
    for (const row of byYear) {
      console.log(`  ${row.year}: ${row.count} schools`);
    }

    const byCategory = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM school_metrics
      WHERE year = '2024-25'
      GROUP BY category
      ORDER BY count DESC
    `).all() as { category: string; count: number }[];
    console.log('\n2024-25 categories:');
    for (const row of byCategory) {
      console.log(`  ${row.category}: ${row.count} schools`);
    }

    const persistentCount = this.db.prepare('SELECT COUNT(*) as count FROM persistent_gems').get() as { count: number };
    console.log(`\nPersistent gems: ${persistentCount.count}`);

    // New table counts
    const locationCount = this.db.prepare('SELECT COUNT(*) as count FROM school_locations').get() as { count: number };
    const locationWithCoords = this.db.prepare('SELECT COUNT(*) as count FROM school_locations WHERE latitude IS NOT NULL').get() as { count: number };
    console.log(`\nLocation records: ${locationCount.count} (${locationWithCoords.count} with coordinates)`);

    const budgetCount = this.db.prepare('SELECT COUNT(*) as count FROM school_budgets').get() as { count: number };
    console.log(`Budget records: ${budgetCount.count}`);

    const suspensionCount = this.db.prepare('SELECT COUNT(*) as count FROM school_suspensions').get() as { count: number };
    const redactedCount = this.db.prepare('SELECT COUNT(*) as count FROM school_suspensions WHERE is_redacted = 1').get() as { count: number };
    console.log(`Suspension records: ${suspensionCount.count} (${redactedCount.count} with redacted values)`);

    const ptaCount = this.db.prepare('SELECT COUNT(*) as count FROM pta_data').get() as { count: number };
    console.log(`PTA records: ${ptaCount.count}`);

    const stats = this.db.prepare('SELECT * FROM citywide_stats WHERE year = ?').get('2024-25') as Record<string, unknown>;
    if (stats) {
      console.log('\n2024-25 citywide medians:');
      console.log(`  Impact Score: ${(stats.median_impact_score as number).toFixed(2)}`);
      console.log(`  Performance Score: ${(stats.median_performance_score as number).toFixed(2)}`);
      console.log(`  Economic Need: ${(stats.median_economic_need as number).toFixed(2)}`);
    }
  }

  async run(): Promise<void> {
    console.log('Starting NYC School Data Pipeline...\n');

    this.initializeSchema();

    // Process all report files
    for (const config of REPORT_FILES) {
      this.parseExcelFile(config);
    }

    // Process PTA files (now 3 years)
    this.parsePTAFiles();

    // Process location data
    this.parseLCGMSFile();
    await this.parseShapePoints();

    // Process budget data
    this.parseBudgetFiles();

    // Process suspension data
    this.parseSuspensionFiles();

    // Compute derived data
    this.computePersistentGems();
    this.computeCitywideStats();

    // Print summary
    this.printSummary();

    // Close database
    this.db.close();
    console.log('\nDatabase created at:', DB_PATH);
  }
}

// Run the pipeline
const pipeline = new DataPipeline();
pipeline.run().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
