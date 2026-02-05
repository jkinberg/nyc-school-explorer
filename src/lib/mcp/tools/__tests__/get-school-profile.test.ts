import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSchoolProfileTool } from '../get-school-profile';
import * as queries from '@/lib/db/queries';
import { testSchools, testMetrics, testCitywideStats, testLocations, testBudgets, testSuspensions, testPTAData } from '@/lib/db/__tests__/fixtures';
import type { SchoolProfile } from '@/lib/db/queries';
import type { CitywideStat } from '@/types/school';

// Mock the database queries module
vi.mock('@/lib/db/queries', () => ({
  getSchoolProfile: vi.fn(),
  getCitywideStats: vi.fn(),
  findSchoolsByNameOrDBN: vi.fn(),
}));

describe('getSchoolProfileTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(queries.getCitywideStats).mockReturnValue(testCitywideStats[0] as CitywideStat);
    vi.mocked(queries.findSchoolsByNameOrDBN).mockReturnValue([]);
  });

  describe('successful profile lookup', () => {
    it('returns profile for valid DBN', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[0],
        metrics: {
          current: testMetrics[0],
          previous: testMetrics[1],
        },
        isPersistentGem: true,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: testLocations[0],
        budgets: testBudgets,
        suspensions: testSuspensions,
        pta: testPTAData,
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '13K123' });

      expect(result.profile).not.toBeNull();
      expect(result.profile?.school.dbn).toBe('13K123');
      expect(result.suggestions).toBeUndefined();
    });

    it('includes both current and previous metrics', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[0],
        metrics: {
          current: testMetrics[0],
          previous: testMetrics[1],
        },
        isPersistentGem: true,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: testLocations[0],
        budgets: testBudgets,
        suspensions: testSuspensions,
        pta: testPTAData,
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '13K123' });

      expect(result.profile?.metrics.current).toBeDefined();
      expect(result.profile?.metrics.previous).toBeDefined();
      expect(result.profile?.metrics.current?.year).toBe('2024-25');
      expect(result.profile?.metrics.previous?.year).toBe('2023-24');
    });

    it('includes location, budgets, suspensions, and PTA data', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[0],
        metrics: {
          current: testMetrics[0],
          previous: testMetrics[1],
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: testLocations[0],
        budgets: testBudgets,
        suspensions: testSuspensions,
        pta: testPTAData,
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '13K123' });

      expect(result.profile?.location).toBeDefined();
      expect(result.profile?.budgets).toHaveLength(2);
      expect(result.profile?.suspensions).toHaveLength(2);
      expect(result.profile?.pta).toHaveLength(2);
    });
  });

  describe('profile not found', () => {
    it('returns null profile when DBN not found', () => {
      vi.mocked(queries.getSchoolProfile).mockReturnValue(null);
      vi.mocked(queries.findSchoolsByNameOrDBN).mockReturnValue([
        { dbn: '13K123', name: 'P.S. 123 Excellence Academy', borough: 'Brooklyn' },
      ]);

      const result = getSchoolProfileTool({ dbn: 'INVALID' });

      expect(result.profile).toBeNull();
    });

    it('returns suggestions when DBN not found', () => {
      vi.mocked(queries.getSchoolProfile).mockReturnValue(null);
      vi.mocked(queries.findSchoolsByNameOrDBN).mockReturnValue([
        { dbn: '13K123', name: 'P.S. 123 Excellence Academy', borough: 'Brooklyn' },
        { dbn: '13K124', name: 'P.S. 124 Brooklyn School', borough: 'Brooklyn' },
      ]);

      const result = getSchoolProfileTool({ dbn: 'Brooklyn School' });

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions?.[0].name).toBe('P.S. 123 Excellence Academy');
    });

    it('does not include suggestions if none found', () => {
      vi.mocked(queries.getSchoolProfile).mockReturnValue(null);
      vi.mocked(queries.findSchoolsByNameOrDBN).mockReturnValue([]);

      const result = getSchoolProfileTool({ dbn: 'COMPLETELY_INVALID' });

      expect(result.profile).toBeNull();
      expect(result.suggestions).toBeUndefined();
    });
  });

  describe('context and limitations', () => {
    it('includes citywide medians in context', () => {
      vi.mocked(queries.getSchoolProfile).mockReturnValue(null);

      const result = getSchoolProfileTool({ dbn: 'ANY' });

      expect(result._context.citywide_medians).toEqual({
        impact: 0.50,
        performance: 0.49,
        eni: 0.72,
      });
    });

    it('includes methodology note', () => {
      vi.mocked(queries.getSchoolProfile).mockReturnValue(null);

      const result = getSchoolProfileTool({ dbn: 'ANY' });

      expect(result._context.methodology_note).toContain('Profile');
      expect(result._context.methodology_note).toContain('ENI');
    });

    it('sets sample_size to 1 when profile found', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[0],
        metrics: {
          current: testMetrics[0],
          previous: undefined,
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '13K123' });

      expect(result._context.sample_size).toBe(1);
    });

    it('sets sample_size to 0 when profile not found', () => {
      vi.mocked(queries.getSchoolProfile).mockReturnValue(null);

      const result = getSchoolProfileTool({ dbn: 'INVALID' });

      expect(result._context.sample_size).toBe(0);
    });

    it('adds year-over-year limitation when both years available', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[0],
        metrics: {
          current: testMetrics[0],
          previous: testMetrics[1],
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '13K123' });

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('Year-over-year')
      );
    });

    it('adds single year limitation when only one year available', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[0],
        metrics: {
          current: testMetrics[0],
          previous: undefined,
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '13K123' });

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('Only one year')
      );
    });

    it('adds persistent gem limitation when school is persistent gem', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[0],
        metrics: {
          current: testMetrics[0],
          previous: testMetrics[1],
        },
        isPersistentGem: true,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '13K123' });

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('Persistent high growth')
      );
    });

    it('adds small school limitation for enrollment < 200', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[10], // Small school
        metrics: {
          current: { ...testMetrics[12], enrollment: 85 },
          previous: undefined,
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '14K333' });

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('Small school enrollment')
      );
    });

    it('adds suspension redaction limitation when has redacted suspensions', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[0],
        metrics: {
          current: testMetrics[0],
          previous: undefined,
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [testSuspensions[1]], // Redacted suspension
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '13K123' });

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('redacted')
      );
    });

    it('adds charter budget limitation for charter schools', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[6], // Charter school
        metrics: {
          current: testMetrics[7],
          previous: undefined,
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: testBudgets,
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '84K001' });

      expect(result._context.limitations).toContainEqual(
        expect.stringContaining('Charter school budget')
      );
    });
  });

  describe('category mapping', () => {
    it('maps "developing" to "below_growth_threshold" in current metrics', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[3],
        metrics: {
          current: { ...testMetrics[4], category: 'developing' },
          previous: undefined,
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '24Q234' });

      expect(result.profile?.metrics.current?.category).toBe('below_growth_threshold');
    });

    it('maps "below_threshold" to "lower_economic_need" in current metrics', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[4],
        metrics: {
          current: { ...testMetrics[5], category: 'below_threshold' },
          previous: undefined,
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '31R567' });

      expect(result.profile?.metrics.current?.category).toBe('lower_economic_need');
    });

    it('maps categories in previous metrics', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[3],
        metrics: {
          current: testMetrics[4],
          previous: { ...testMetrics[4], year: '2023-24', category: 'developing' },
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '24Q234' });

      expect(result.profile?.metrics.previous?.category).toBe('below_growth_threshold');
    });

    it('maps categories in similar schools', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[0],
        metrics: {
          current: testMetrics[0],
          previous: undefined,
        },
        isPersistentGem: false,
        similarSchools: [
          {
            ...testSchools[3],
            year: '2024-25',
            enrollment: 410,
            impact_score: 0.45,
            performance_score: 0.38,
            economic_need_index: 0.92,
            category: 'developing' as const,
          },
        ],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '13K123' });

      expect(result.profile?.similarSchools[0].category).toBe('below_growth_threshold');
    });

    it('preserves other category values', () => {
      const mockProfile: SchoolProfile = {
        school: testSchools[0],
        metrics: {
          current: testMetrics[0],
          previous: undefined,
        },
        isPersistentGem: false,
        similarSchools: [],
        citywideStats: testCitywideStats[0] as CitywideStat,
        location: undefined,
        budgets: [],
        suspensions: [],
        pta: [],
      };
      vi.mocked(queries.getSchoolProfile).mockReturnValue(mockProfile);

      const result = getSchoolProfileTool({ dbn: '13K123' });

      expect(result.profile?.metrics.current?.category).toBe('high_growth_high_achievement');
    });
  });

  describe('fallback values', () => {
    it('uses fallback citywide medians when stats not available', () => {
      vi.mocked(queries.getSchoolProfile).mockReturnValue(null);
      vi.mocked(queries.getCitywideStats).mockReturnValue(undefined);

      const result = getSchoolProfileTool({ dbn: 'ANY' });

      expect(result._context.citywide_medians.impact).toBe(0.50);
      expect(result._context.citywide_medians.performance).toBe(0.50);
      expect(result._context.citywide_medians.eni).toBe(0.72);
    });
  });
});
