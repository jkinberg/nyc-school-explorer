import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compareSchoolsTool, type CompareSchoolsParams } from '../compare-schools';
import * as queries from '@/lib/db/queries';
import { testSchools, testMetrics, testCitywideStats, testBudgets, testPTAData, testSuspensions } from '@/lib/db/__tests__/fixtures';
import type { SchoolWithMetrics, CitywideStat, School, SchoolMetrics, SchoolBudget, PTAData, SchoolSuspension } from '@/types/school';

// Mock the database queries module
vi.mock('@/lib/db/queries', () => ({
  searchSchools: vi.fn(),
  getCitywideStats: vi.fn(),
  getSchoolByDBN: vi.fn(),
  getLatestMetrics: vi.fn(),
  getMetricsByDBN: vi.fn(),
  findSimilarSchools: vi.fn(),
  findSchoolsByNameOrDBN: vi.fn(),
  getBudgetsByDBN: vi.fn(),
  getSuspensionsByDBN: vi.fn(),
  getPTAByDBN: vi.fn(),
}));

describe('compareSchoolsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(queries.getCitywideStats).mockReturnValue(testCitywideStats[0] as CitywideStat);
    vi.mocked(queries.getBudgetsByDBN).mockReturnValue([]);
    vi.mocked(queries.getSuspensionsByDBN).mockReturnValue([]);
    vi.mocked(queries.getPTAByDBN).mockReturnValue([]);
  });

  describe('specific school comparison', () => {
    it('compares 2 schools by DBN', () => {
      // Setup mocks for two schools
      vi.mocked(queries.getSchoolByDBN)
        .mockReturnValueOnce(testSchools[0] as School) // 13K123
        .mockReturnValueOnce(testSchools[1] as School); // 09X456

      vi.mocked(queries.getLatestMetrics)
        .mockReturnValueOnce(testMetrics[0] as SchoolMetrics) // 13K123
        .mockReturnValueOnce(testMetrics[2] as SchoolMetrics); // 09X456

      const result = compareSchoolsTool({ dbns: ['13K123', '09X456'] });

      expect(result.comparison.schools).toHaveLength(2);
      expect(result.comparison.comparison_type).toBe('specific');
      expect(result.comparison.schools[0].dbn).toBe('13K123');
      expect(result.comparison.schools[1].dbn).toBe('09X456');
    });

    it('resolves school names to DBNs', () => {
      // Mock name resolution
      vi.mocked(queries.findSchoolsByNameOrDBN)
        .mockReturnValueOnce([{ dbn: '02M475', name: 'Stuyvesant High School', borough: 'Manhattan' }]);

      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[9] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[11] as SchoolMetrics);

      const result = compareSchoolsTool({ dbns: ['Stuyvesant'] });

      expect(queries.findSchoolsByNameOrDBN).toHaveBeenCalledWith('Stuyvesant', 1);
      expect(result.comparison.schools).toHaveLength(1);
      expect(result.comparison.schools[0].dbn).toBe('02M475');
    });

    it('includes all default metrics', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);

      const result = compareSchoolsTool({ dbns: ['13K123'] });
      const school = result.comparison.schools[0];

      // Core metrics
      expect(school).toHaveProperty('impact_score');
      expect(school).toHaveProperty('performance_score');
      expect(school).toHaveProperty('economic_need_index');
      expect(school).toHaveProperty('enrollment');
      expect(school).toHaveProperty('category');

      // Attendance (default)
      expect(school).toHaveProperty('student_attendance');
      expect(school).toHaveProperty('teacher_attendance');

      // Should have correct values
      expect(school.impact_score).toBe(0.62);
      expect(school.performance_score).toBe(0.58);
      expect(school.economic_need_index).toBe(0.91);
    });

    it('limits to 10 schools max', () => {
      // Mock 12 schools
      for (let i = 0; i < 12; i++) {
        vi.mocked(queries.getSchoolByDBN).mockReturnValueOnce(testSchools[0] as School);
        vi.mocked(queries.getLatestMetrics).mockReturnValueOnce(testMetrics[0] as SchoolMetrics);
      }

      const dbns = Array(12).fill('13K123');
      const result = compareSchoolsTool({ dbns });

      expect(result.comparison.schools.length).toBeLessThanOrEqual(10);
    });
  });

  describe('citywide comparison', () => {
    it('sets include_citywide_column when compare_to_citywide=true', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);

      const result = compareSchoolsTool({
        dbns: ['13K123'],
        compare_to_citywide: true,
      });

      expect(result.comparison.include_citywide_column).toBe(true);
      expect(result._context.citywide_medians).toBeDefined();
      expect(result._context.citywide_medians.impact).toBe(0.50);
      expect(result._context.citywide_medians.performance).toBe(0.49);
    });
  });

  describe('similar schools comparison', () => {
    it('finds similar schools when compare_to_similar=true', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);

      const mockSimilarSchools: SchoolWithMetrics[] = [
        {
          ...testSchools[1],
          year: '2024-25',
          enrollment: 380,
          impact_score: 0.59,
          performance_score: 0.42,
          economic_need_index: 0.95,
          category: 'high_growth',
        },
      ];
      vi.mocked(queries.findSimilarSchools).mockReturnValue(mockSimilarSchools);

      const result = compareSchoolsTool({
        dbns: ['13K123'],
        compare_to_similar: true,
        limit: 5,
      });

      expect(result.comparison.schools.length).toBeGreaterThan(1);
      expect(result.comparison.comparison_type).toBe('vs_similar');
      expect(queries.findSimilarSchools).toHaveBeenCalledWith(
        expect.objectContaining({ dbn: '13K123' })
      );
    });
  });

  describe('filtered comparison', () => {
    it('compares top schools matching filter', () => {
      const mockSchools: SchoolWithMetrics[] = [
        {
          ...testSchools[0],
          year: '2024-25',
          enrollment: 450,
          impact_score: 0.62,
          performance_score: 0.58,
          economic_need_index: 0.91,
          category: 'high_growth',
        },
        {
          ...testSchools[1],
          year: '2024-25',
          enrollment: 380,
          impact_score: 0.59,
          performance_score: 0.42,
          economic_need_index: 0.95,
          category: 'high_growth',
        },
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = compareSchoolsTool({
        filter: { borough: 'Brooklyn', category: 'high_growth' },
        limit: 5,
      });

      expect(result.comparison.schools.length).toBeLessThanOrEqual(5);
      expect(result.comparison.comparison_type).toBe('filtered');
      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({
          borough: 'Brooklyn',
          category: 'high_growth',
        })
      );
    });

    it('maps user-facing category to DB category', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      compareSchoolsTool({
        filter: { category: 'below_growth_threshold' as 'high_growth' },
      });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'developing',
        })
      );
    });
  });

  describe('trend data', () => {
    it('includes YoY change when include_trends=true', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);
      vi.mocked(queries.getMetricsByDBN).mockReturnValue([testMetrics[1] as SchoolMetrics]); // 2023-24

      const result = compareSchoolsTool({
        dbns: ['13K123'],
        include_trends: true,
      });

      const school = result.comparison.schools[0];
      expect(school).toHaveProperty('impact_score_change');
      expect(school).toHaveProperty('performance_score_change');
      // 0.62 - 0.58 = 0.04
      expect(school.impact_score_change).toBeCloseTo(0.04, 2);
    });

    it('handles missing previous year data gracefully', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);
      vi.mocked(queries.getMetricsByDBN).mockReturnValue([]); // No previous year

      const result = compareSchoolsTool({
        dbns: ['13K123'],
        include_trends: true,
      });

      const school = result.comparison.schools[0];
      // Should not crash, changes should be null or undefined
      expect(school.impact_score_change).toBeUndefined();
    });
  });

  describe('optional metrics', () => {
    it('includes budget data when requested', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);
      vi.mocked(queries.getBudgetsByDBN).mockReturnValue(testBudgets as SchoolBudget[]);

      const result = compareSchoolsTool({
        dbns: ['13K123'],
        metrics: ['impact_score', 'total_budget', 'pct_funded'],
      });

      const school = result.comparison.schools[0];
      expect(school.total_budget).toBe(5500000);
      expect(school.pct_funded).toBe(0.92);
    });

    it('includes PTA data when requested', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);
      vi.mocked(queries.getPTAByDBN).mockReturnValue(testPTAData as PTAData[]);

      const result = compareSchoolsTool({
        dbns: ['13K123'],
        metrics: ['impact_score', 'pta_income'],
      });

      const school = result.comparison.schools[0];
      expect(school.pta_income).toBe(45000);
    });

    it('includes suspension data when requested', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);
      vi.mocked(queries.getSuspensionsByDBN).mockReturnValue(testSuspensions as SchoolSuspension[]);

      const result = compareSchoolsTool({
        dbns: ['13K123'],
        metrics: ['impact_score', 'total_suspensions'],
      });

      const school = result.comparison.schools[0];
      expect(school.total_suspensions).toBe(9);
    });

    it('includes survey scores when requested', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);

      const result = compareSchoolsTool({
        dbns: ['13K123'],
        metrics: ['impact_score', 'survey_family_involvement', 'survey_safety'],
      });

      const school = result.comparison.schools[0];
      expect(school.survey_family_involvement).toBe(0.72);
      expect(school.survey_safety).toBe(0.82);
    });
  });

  describe('context and limitations', () => {
    it('includes citywide medians in context', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);

      const result = compareSchoolsTool({ dbns: ['13K123'] });

      expect(result._context.citywide_medians).toEqual({
        impact: 0.50,
        performance: 0.49,
        eni: 0.72,
      });
    });

    it('warns about ENI differences when comparing schools', () => {
      // Setup two schools with very different ENI
      vi.mocked(queries.getSchoolByDBN)
        .mockReturnValueOnce(testSchools[1] as School) // 09X456 - high poverty
        .mockReturnValueOnce(testSchools[4] as School); // 31R567 - low poverty

      vi.mocked(queries.getLatestMetrics)
        .mockReturnValueOnce(testMetrics[2] as SchoolMetrics) // ENI 0.95
        .mockReturnValueOnce(testMetrics[5] as SchoolMetrics); // ENI 0.45

      const result = compareSchoolsTool({ dbns: ['09X456', '31R567'] });

      expect(result._context.limitations).toContainEqual(
        expect.stringMatching(/ENI|economic need/i)
      );
    });

    it('warns about charter comparisons when budget is requested', () => {
      vi.mocked(queries.getSchoolByDBN)
        .mockReturnValueOnce(testSchools[0] as School) // district school
        .mockReturnValueOnce(testSchools[6] as School); // charter

      vi.mocked(queries.getLatestMetrics)
        .mockReturnValueOnce(testMetrics[0] as SchoolMetrics)
        .mockReturnValueOnce(testMetrics[7] as SchoolMetrics);

      vi.mocked(queries.getBudgetsByDBN).mockReturnValue([]);

      const result = compareSchoolsTool({
        dbns: ['13K123', '84K001'],
        metrics: ['impact_score', 'total_budget'],
      });

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('charter')
      );
    });

    it('includes PTA caveat when PTA income is requested', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);
      vi.mocked(queries.getPTAByDBN).mockReturnValue([]);

      const result = compareSchoolsTool({
        dbns: ['13K123'],
        metrics: ['impact_score', 'pta_income'],
      });

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('PTA')
      );
    });
  });

  describe('category mapping', () => {
    it('maps "developing" to "below_growth_threshold"', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[3] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue({
        ...testMetrics[4],
        category: 'developing' as SchoolMetrics['category'],
      } as SchoolMetrics);

      const result = compareSchoolsTool({ dbns: ['24Q234'] });

      expect(result.comparison.schools[0].category).toBe('below_growth_threshold');
    });

    it('maps "below_threshold" to "lower_economic_need"', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[4] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue({
        ...testMetrics[5],
        category: 'below_threshold' as SchoolMetrics['category'],
      } as SchoolMetrics);

      const result = compareSchoolsTool({ dbns: ['31R567'] });

      expect(result.comparison.schools[0].category).toBe('lower_economic_need');
    });

    it('preserves other category values', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);

      const result = compareSchoolsTool({ dbns: ['13K123'] });

      expect(result.comparison.schools[0].category).toBe('high_growth_high_achievement');
    });
  });

  describe('empty results', () => {
    it('handles empty DBN list gracefully', () => {
      const result = compareSchoolsTool({ dbns: [] });

      expect(result.comparison.schools).toEqual([]);
      expect(result._context).toBeDefined();
    });

    it('handles unresolved school names gracefully', () => {
      vi.mocked(queries.findSchoolsByNameOrDBN).mockReturnValue([]);

      const result = compareSchoolsTool({ dbns: ['NonexistentSchool'] });

      expect(result.comparison.schools).toEqual([]);
    });

    it('handles school not found in database', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(undefined);

      const result = compareSchoolsTool({ dbns: ['99X999'] });

      expect(result.comparison.schools).toEqual([]);
    });
  });

  describe('metrics_included tracking', () => {
    it('tracks which metrics are included', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);

      const result = compareSchoolsTool({
        dbns: ['13K123'],
        metrics: ['impact_score', 'survey_safety'],
      });

      expect(result.comparison.metrics_included).toContain('impact_score');
      expect(result.comparison.metrics_included).toContain('survey_safety');
    });

    it('uses default metrics when none specified', () => {
      vi.mocked(queries.getSchoolByDBN).mockReturnValue(testSchools[0] as School);
      vi.mocked(queries.getLatestMetrics).mockReturnValue(testMetrics[0] as SchoolMetrics);

      const result = compareSchoolsTool({ dbns: ['13K123'] });

      expect(result.comparison.metrics_included).toContain('impact_score');
      expect(result.comparison.metrics_included).toContain('performance_score');
      expect(result.comparison.metrics_included).toContain('economic_need_index');
      expect(result.comparison.metrics_included).toContain('category');
    });
  });
});
