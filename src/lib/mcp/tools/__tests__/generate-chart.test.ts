import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateChartTool, type GenerateChartParams } from '../generate-chart';
import * as queries from '@/lib/db/queries';
import { testSchools, testMetrics, testCitywideStats } from '@/lib/db/__tests__/fixtures';
import type { SchoolWithMetrics, CitywideStat } from '@/types/school';

// Mock the database queries module
vi.mock('@/lib/db/queries', () => ({
  searchSchools: vi.fn(),
  getCitywideStats: vi.fn(),
}));

// Helper to create SchoolWithMetrics from fixtures
function createSchoolWithMetrics(schoolIndex: number, metricsIndex: number): SchoolWithMetrics {
  const school = testSchools[schoolIndex];
  const metrics = testMetrics[metricsIndex];
  return {
    ...school,
    ...metrics,
  };
}

describe('generateChartTool - diverging_bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queries.getCitywideStats).mockReturnValue(testCitywideStats[0] as CitywideStat);
  });

  describe('Impact Score deviation', () => {
    it('calculates deviation from 0.50 midpoint by default', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0), // impact: 0.62
        createSchoolWithMetrics(1, 2), // impact: 0.59
        createSchoolWithMetrics(3, 4), // impact: 0.45
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
      });

      expect(result.chart.type).toBe('diverging_bar');
      expect(result.chart.midpoint).toBe(0.50);

      // Check that deviations are calculated correctly
      const data = result.chart.data;
      expect(data.length).toBe(3);

      // Data should be sorted by absolute deviation (largest first)
      const deviations = data.map(d => Math.abs(d.deviation as number));
      expect(deviations).toEqual([...deviations].sort((a, b) => b - a));

      // Verify isPositive flag
      data.forEach(school => {
        const deviation = school.deviation as number;
        expect(school.isPositive).toBe(deviation > 0);
      });
    });

    it('uses custom midpoint when provided', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0), // impact: 0.62
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        midpoint: 0.55,
      });

      expect(result.chart.midpoint).toBe(0.55);
      // Deviation should be 0.62 - 0.55 = 0.07
      expect(result.chart.data[0].deviation).toBeCloseTo(0.07, 2);
    });

    it('respects borough filter', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        filter: { borough: 'Bronx' },
      });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ borough: 'Bronx' })
      );
    });

    it('respects min_eni filter', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        filter: { min_eni: 0.85 },
      });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ minEni: 0.85 })
      );
    });

    it('respects is_charter filter', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        filter: { is_charter: true },
      });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ isCharter: true })
      );
    });

    it('respects report_type filter', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        filter: { report_type: 'EMS' },
      });

      expect(queries.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ reportType: 'EMS' })
      );
    });
  });

  describe('Year-over-year change', () => {
    it('calculates change with midpoint=0 when show_change=true', () => {
      // 2023-24 data
      const schools2324: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[1] }, // impact: 0.58
      ];
      // 2024-25 data
      const schools2425: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[0] }, // impact: 0.62
      ];

      vi.mocked(queries.searchSchools)
        .mockReturnValueOnce(schools2324) // First call for 2023-24
        .mockReturnValueOnce(schools2425); // Second call for 2024-25

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        show_change: true,
      });

      expect(result.chart.midpoint).toBe(0);
      expect(result.chart.data.length).toBe(1);

      // Change should be 0.62 - 0.58 = 0.04
      const schoolData = result.chart.data[0];
      expect(schoolData.value).toBeCloseTo(0.04, 2);
      expect(schoolData.deviation).toBeCloseTo(0.04, 2);
      expect(schoolData.isPositive).toBe(true);
    });

    it('excludes schools without both years of data', () => {
      // 2023-24 data - only one school
      const schools2324: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[1] },
      ];
      // 2024-25 data - different school
      const schools2425: SchoolWithMetrics[] = [
        { ...testSchools[1], ...testMetrics[2] },
      ];

      vi.mocked(queries.searchSchools)
        .mockReturnValueOnce(schools2324)
        .mockReturnValueOnce(schools2425);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        show_change: true,
      });

      // No matching schools between years
      expect(result.chart.data.length).toBe(0);
    });

    it('includes limitation about schools present in both years', () => {
      const schools2324: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[1] },
      ];
      const schools2425: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[0] },
      ];

      vi.mocked(queries.searchSchools)
        .mockReturnValueOnce(schools2324)
        .mockReturnValueOnce(schools2425);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        show_change: true,
      });

      expect(result._context.limitations).toContainEqual(
        expect.stringMatching(/schools present in both/i)
      );
    });
  });

  describe('Sorting behavior', () => {
    it('sorts by absolute deviation (largest first) by default', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0), // impact: 0.62, deviation: +0.12
        createSchoolWithMetrics(3, 4), // impact: 0.45, deviation: -0.05
        createSchoolWithMetrics(2, 3), // impact: 0.48, deviation: -0.02
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
      });

      const deviations = result.chart.data.map(s => Math.abs(s.deviation as number));
      expect(deviations).toEqual([...deviations].sort((a, b) => b - a));
    });

    it('respects limit parameter', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0),
        createSchoolWithMetrics(1, 2),
        createSchoolWithMetrics(2, 3),
        createSchoolWithMetrics(3, 4),
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        limit: 2,
      });

      expect(result.chart.data.length).toBe(2);
    });
  });

  describe('Other metrics', () => {
    it('uses default midpoint for student_attendance (~0.90)', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0), // student_attendance: 0.94
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'student_attendance',
      });

      expect(result.chart.midpoint).toBe(0.90);
    });

    it('uses default midpoint for performance_score (~0.49)', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0), // performance_score: 0.58
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'performance_score',
      });

      expect(result.chart.midpoint).toBe(0.49);
    });

    it('falls back to citywide median for unknown metrics', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0),
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'economic_need_index',
      });

      // Should use citywide median (0.72 from fixtures)
      expect(result.chart.midpoint).toBe(0.72);
    });
  });

  describe('Empty results', () => {
    it('handles empty results gracefully', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        filter: { borough: 'Staten Island', category: 'high_growth' },
      });

      expect(result.chart.data).toEqual([]);
      // Check that error is in context (as generic property)
      expect((result._context as Record<string, unknown>).error).toBe('NO_DATA_MATCHED');
    });
  });

  describe('Context and metadata', () => {
    it('includes sample size in context', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0),
        createSchoolWithMetrics(1, 2),
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
      });

      expect(result._context.sample_size).toBe(2);
    });

    it('includes citywide medians in context', () => {
      vi.mocked(queries.searchSchools).mockReturnValue([]);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
      });

      expect(result._context.citywide_medians).toEqual({
        impact: 0.50,
        performance: 0.49,
        eni: 0.72,
      });
    });

    it('includes methodology note for deviation charts', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0),
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
      });

      expect(result._context.methodology_note).toContain('threshold');
    });

    it('includes methodology note for change charts', () => {
      const schools2324: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[1] },
      ];
      const schools2425: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[0] },
      ];

      vi.mocked(queries.searchSchools)
        .mockReturnValueOnce(schools2324)
        .mockReturnValueOnce(schools2425);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        show_change: true,
      });

      expect(result._context.methodology_note).toContain('improvement');
    });

    it('generates appropriate title for deviation charts', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0),
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
      });

      expect(result.chart.title).toContain('Impact Score');
      expect(result.chart.title).toContain('0.50');
    });

    it('generates appropriate title for change charts', () => {
      const schools2324: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[1] },
      ];
      const schools2425: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[0] },
      ];

      vi.mocked(queries.searchSchools)
        .mockReturnValueOnce(schools2324)
        .mockReturnValueOnce(schools2425);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        show_change: true,
      });

      expect(result.chart.title).toContain('Year-over-Year');
    });

    it('uses custom title when provided', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0),
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        title: 'Custom Title',
      });

      expect(result.chart.title).toBe('Custom Title');
    });
  });

  describe('Data structure', () => {
    it('includes required fields in data points', () => {
      const mockSchools: SchoolWithMetrics[] = [
        createSchoolWithMetrics(0, 0),
      ];
      vi.mocked(queries.searchSchools).mockReturnValue(mockSchools);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
      });

      const dataPoint = result.chart.data[0];
      expect(dataPoint).toHaveProperty('name');
      expect(dataPoint).toHaveProperty('dbn');
      expect(dataPoint).toHaveProperty('value');
      expect(dataPoint).toHaveProperty('deviation');
      expect(dataPoint).toHaveProperty('isPositive');
      expect(dataPoint).toHaveProperty('economic_need_index');
    });

    it('includes year values for show_change charts', () => {
      const schools2324: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[1] },
      ];
      const schools2425: SchoolWithMetrics[] = [
        { ...testSchools[0], ...testMetrics[0] },
      ];

      vi.mocked(queries.searchSchools)
        .mockReturnValueOnce(schools2324)
        .mockReturnValueOnce(schools2425);

      const result = generateChartTool({
        chart_type: 'diverging_bar',
        x_metric: 'impact_score',
        show_change: true,
      });

      const dataPoint = result.chart.data[0];
      expect(dataPoint).toHaveProperty('value_2324');
      expect(dataPoint).toHaveProperty('value_2425');
    });
  });
});
