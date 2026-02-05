import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchSchoolsTool, type SearchSchoolsParams } from '../search-schools';
import * as queries from '@/lib/db/queries';
import { testSchools, testMetrics, testCitywideStats } from '@/lib/db/__tests__/fixtures';
import type { SchoolWithMetrics, CitywideStat } from '@/types/school';

// Mock the database queries module
vi.mock('@/lib/db/queries', () => ({
  searchSchools: vi.fn(),
  countSchools: vi.fn(),
  getCitywideStats: vi.fn(),
}));

describe('searchSchoolsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(queries.getCitywideStats).mockReturnValue(testCitywideStats[0] as CitywideStat);
    vi.mocked(queries.countSchools).mockReturnValue(10);
  });

  describe('basic functionality', () => {
    it('returns schools with context', () => {
      const mockSchools: SchoolWithMetrics[] = [
        {
          ...testSchools[0],
          year: '2024-25',
          enrollment: 450,
          impact_score: 0.62,
          performance_score: 0.58,
          economic_need_index: 0.91,
          category: 'high_growth_high_achievement',
        },
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = searchSchoolsTool({});

      expect(result.schools).toHaveLength(1);
      expect(result._context).toBeDefined();
      expect(result._context.data_year).toBe('2024-25');
      expect(result._context.citywide_medians).toBeDefined();
    });

    it('uses default year 2024-25', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      searchSchoolsTool({});

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ year: '2024-25' })
      );
    });

    it('uses default limit of 10', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      searchSchoolsTool({});

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });

    it('caps limit at 100', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      searchSchoolsTool({ limit: 200 });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);
    });

    it('passes borough filter', () => {
      searchSchoolsTool({ borough: 'Brooklyn' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ borough: 'Brooklyn' })
      );
    });

    it('passes report_type filter', () => {
      searchSchoolsTool({ report_type: 'EMS' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ reportType: 'EMS' })
      );
    });

    it('passes category filter', () => {
      searchSchoolsTool({ category: 'high_growth' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'high_growth' })
      );
    });

    it('passes min_impact_score filter', () => {
      searchSchoolsTool({ min_impact_score: 0.55 });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ minImpactScore: 0.55 })
      );
    });

    it('passes max_impact_score filter', () => {
      searchSchoolsTool({ max_impact_score: 0.75 });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ maxImpactScore: 0.75 })
      );
    });

    it('passes min_eni filter', () => {
      searchSchoolsTool({ min_eni: 0.85 });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ minEni: 0.85 })
      );
    });

    it('passes is_charter filter', () => {
      searchSchoolsTool({ is_charter: true });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ isCharter: true })
      );
    });

    it('combines multiple filters', () => {
      searchSchoolsTool({
        borough: 'Brooklyn',
        report_type: 'EMS',
        min_eni: 0.85,
        category: 'high_growth',
      });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({
          borough: 'Brooklyn',
          reportType: 'EMS',
          minEni: 0.85,
          category: 'high_growth',
        })
      );
    });
  });

  describe('sorting', () => {
    beforeEach(() => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);
    });

    it('passes sort_by parameter', () => {
      searchSchoolsTool({ sort_by: 'impact_score' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'impact_score' })
      );
    });

    it('passes sort_order parameter', () => {
      searchSchoolsTool({ sort_order: 'asc' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 'asc' })
      );
    });

    it('supports sorting by student_attendance', () => {
      searchSchoolsTool({ sort_by: 'student_attendance', sort_order: 'asc' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'student_attendance',
          sortOrder: 'asc',
        })
      );
    });

    it('supports sorting by enrollment', () => {
      searchSchoolsTool({ sort_by: 'enrollment', sort_order: 'desc' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'enrollment',
          sortOrder: 'desc',
        })
      );
    });
  });

  describe('query parameter', () => {
    beforeEach(() => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);
    });

    it('passes query for name/DBN search', () => {
      searchSchoolsTool({ query: 'P.S. 188' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'P.S. 188' })
      );
    });

    it('passes DBN as query', () => {
      searchSchoolsTool({ query: '01M188' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ query: '01M188' })
      );
    });
  });

  describe('context and limitations', () => {
    it('includes citywide medians in context', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      const result = searchSchoolsTool({});

      expect(result._context.citywide_medians).toEqual({
        impact: 0.50,
        performance: 0.49,
        eni: 0.72,
      });
    });

    it('includes sample size in context', () => {
      const mockSchools: SchoolWithMetrics[] = [
        {
          ...testSchools[0],
          year: '2024-25',
          enrollment: 450,
          impact_score: 0.62,
          performance_score: 0.58,
          economic_need_index: 0.91,
          category: 'high_growth_high_achievement',
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

      const result = searchSchoolsTool({});

      expect(result._context.sample_size).toBe(2);
    });

    it('includes methodology note', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      const result = searchSchoolsTool({});

      expect(result._context.methodology_note).toContain('Impact Score');
      expect(result._context.methodology_note).toContain('Performance Score');
    });

    it('adds category limitation when filtering by category', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      const result = searchSchoolsTool({ category: 'high_growth' });

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('fixed thresholds')
      );
    });

    it('adds impact score limitation when filtering by impact', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      const result = searchSchoolsTool({ min_impact_score: 0.55 });

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('Impact Score methodology')
      );
    });

    it('adds small sample size warning for < 10 schools', () => {
      const mockSchools: SchoolWithMetrics[] = [
        {
          ...testSchools[0],
          year: '2024-25',
          enrollment: 450,
          impact_score: 0.62,
          performance_score: 0.58,
          economic_need_index: 0.91,
          category: 'high_growth_high_achievement',
        },
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = searchSchoolsTool({});

      expect(result._context.limitations).toContainEqual(
        expect.stringMatching(/Small sample size \(\d+ schools?\) limits generalizability/)
      );
    });

    it('adds charter warning when results include charter schools', () => {
      const mockSchools: SchoolWithMetrics[] = [
        {
          ...testSchools[6], // Charter school
          year: '2024-25',
          enrollment: 320,
          impact_score: 0.68,
          performance_score: 0.55,
          economic_need_index: 0.89,
          category: 'high_growth_high_achievement',
        },
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = searchSchoolsTool({});

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('Charter')
      );
    });
  });

  describe('category mapping', () => {
    it('maps "developing" to "below_growth_threshold"', () => {
      const mockSchools: SchoolWithMetrics[] = [
        {
          ...testSchools[3],
          year: '2024-25',
          enrollment: 410,
          impact_score: 0.45,
          performance_score: 0.38,
          economic_need_index: 0.92,
          category: 'developing' as SchoolWithMetrics['category'],
        },
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = searchSchoolsTool({});

      expect(result.schools[0].category).toBe('below_growth_threshold');
    });

    it('maps "below_threshold" to "lower_economic_need"', () => {
      const mockSchools: SchoolWithMetrics[] = [
        {
          ...testSchools[4],
          year: '2024-25',
          enrollment: 600,
          impact_score: 0.52,
          performance_score: 0.72,
          economic_need_index: 0.45,
          category: 'below_threshold' as SchoolWithMetrics['category'],
        },
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = searchSchoolsTool({});

      expect(result.schools[0].category).toBe('lower_economic_need');
    });

    it('preserves other category values', () => {
      const mockSchools: SchoolWithMetrics[] = [
        {
          ...testSchools[0],
          year: '2024-25',
          enrollment: 450,
          impact_score: 0.62,
          performance_score: 0.58,
          economic_need_index: 0.91,
          category: 'high_growth_high_achievement',
        },
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = searchSchoolsTool({});

      expect(result.schools[0].category).toBe('high_growth_high_achievement');
    });
  });

  describe('total count', () => {
    it('returns total count from countSchools', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);
      vi.mocked(queries.countSchools).mockReturnValue(150);

      const result = searchSchoolsTool({ borough: 'Brooklyn' });

      expect(result.total_count).toBe(150);
    });
  });

  describe('empty results', () => {
    it('handles empty results gracefully', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);
      vi.mocked(queries.countSchools).mockReturnValue(0);

      const result = searchSchoolsTool({ borough: 'Staten Island', category: 'high_growth' });

      expect(result.schools).toEqual([]);
      expect(result.total_count).toBe(0);
      expect(result._context).toBeDefined();
    });
  });

  describe('location-based filtering', () => {
    beforeEach(() => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);
    });

    it('passes nta filter', () => {
      searchSchoolsTool({ nta: 'Lower East Side' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ nta: 'Lower East Side' })
      );
    });

    it('passes council_district filter', () => {
      searchSchoolsTool({ council_district: 33 });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ councilDistrict: 33 })
      );
    });
  });

  describe('year parameter', () => {
    beforeEach(() => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);
    });

    it('accepts 2023-24 year', () => {
      searchSchoolsTool({ year: '2023-24' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ year: '2023-24' })
      );
      expect(queries.getCitywideStats).toHaveBeenCalledWith('2023-24');
    });

    it('accepts 2024-25 year', () => {
      searchSchoolsTool({ year: '2024-25' });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ year: '2024-25' })
      );
      expect(queries.getCitywideStats).toHaveBeenCalledWith('2024-25');
    });
  });
});
