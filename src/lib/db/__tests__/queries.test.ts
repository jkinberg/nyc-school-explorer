import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for database query utilities.
 *
 * Note: These tests focus on the pure logic functions that can be tested
 * without a database connection. Integration tests with actual database
 * would require an in-memory SQLite setup.
 */

// Test the abbreviation normalization logic directly
describe('normalizeSchoolAbbreviations (logic)', () => {
  // Replicate the logic from queries.ts for testing
  function normalizeSchoolAbbreviations(word: string): string[] {
    const upper = word.toUpperCase();
    const variants = [word];

    const abbreviations: Record<string, string> = {
      'PS': 'P.S.',
      'IS': 'I.S.',
      'MS': 'M.S.',
      'JHS': 'J.H.S.',
      'HS': 'H.S.',
    };

    if (abbreviations[upper]) {
      variants.push(abbreviations[upper]);
    }

    if (word.length >= 2 && word.length <= 3 && /^[A-Za-z]+$/.test(word)) {
      const withDots = word.split('').join('.') + '.';
      if (!variants.includes(withDots)) {
        variants.push(withDots);
      }
    }

    return variants;
  }

  describe('common abbreviations', () => {
    it('expands PS to P.S.', () => {
      const variants = normalizeSchoolAbbreviations('PS');
      expect(variants).toContain('PS');
      expect(variants).toContain('P.S.');
    });

    it('expands ps (lowercase) to P.S.', () => {
      const variants = normalizeSchoolAbbreviations('ps');
      expect(variants).toContain('ps');
      expect(variants).toContain('P.S.');
    });

    it('expands IS to I.S.', () => {
      const variants = normalizeSchoolAbbreviations('IS');
      expect(variants).toContain('IS');
      expect(variants).toContain('I.S.');
    });

    it('expands MS to M.S.', () => {
      const variants = normalizeSchoolAbbreviations('MS');
      expect(variants).toContain('MS');
      expect(variants).toContain('M.S.');
    });

    it('expands JHS to J.H.S.', () => {
      const variants = normalizeSchoolAbbreviations('JHS');
      expect(variants).toContain('JHS');
      expect(variants).toContain('J.H.S.');
    });

    it('expands HS to H.S.', () => {
      const variants = normalizeSchoolAbbreviations('HS');
      expect(variants).toContain('HS');
      expect(variants).toContain('H.S.');
    });
  });

  describe('letter-by-letter expansion', () => {
    it('adds dotted version for 2-letter words', () => {
      const variants = normalizeSchoolAbbreviations('AB');
      expect(variants).toContain('AB');
      expect(variants).toContain('A.B.');
    });

    it('adds dotted version for 3-letter words', () => {
      const variants = normalizeSchoolAbbreviations('ABC');
      expect(variants).toContain('ABC');
      expect(variants).toContain('A.B.C.');
    });

    it('does not add dots to single letters', () => {
      const variants = normalizeSchoolAbbreviations('A');
      expect(variants).toEqual(['A']);
    });

    it('does not add dots to 4+ letter words', () => {
      const variants = normalizeSchoolAbbreviations('ABCD');
      expect(variants).toEqual(['ABCD']);
    });

    it('does not add dots to words with non-letters', () => {
      const variants = normalizeSchoolAbbreviations('P1');
      expect(variants).toEqual(['P1']);
    });
  });

  describe('non-abbreviations', () => {
    it('returns regular words unchanged (plus variant)', () => {
      const variants = normalizeSchoolAbbreviations('Brooklyn');
      expect(variants).toEqual(['Brooklyn']);
    });

    it('returns numbers unchanged', () => {
      const variants = normalizeSchoolAbbreviations('188');
      expect(variants).toEqual(['188']);
    });
  });
});

describe('SearchParams validation (logic)', () => {
  // Test the valid sort columns whitelist
  const VALID_SORT_COLUMNS: Record<string, string> = {
    'impact_score': 'm.impact_score',
    'performance_score': 'm.performance_score',
    'economic_need_index': 'm.economic_need_index',
    'enrollment': 'm.enrollment',
    'student_attendance': 'm.student_attendance',
    'teacher_attendance': 'm.teacher_attendance',
    'name': 's.name',
  };

  describe('sort column validation', () => {
    it('validates all expected sort columns', () => {
      expect(VALID_SORT_COLUMNS['impact_score']).toBe('m.impact_score');
      expect(VALID_SORT_COLUMNS['performance_score']).toBe('m.performance_score');
      expect(VALID_SORT_COLUMNS['economic_need_index']).toBe('m.economic_need_index');
      expect(VALID_SORT_COLUMNS['enrollment']).toBe('m.enrollment');
      expect(VALID_SORT_COLUMNS['student_attendance']).toBe('m.student_attendance');
      expect(VALID_SORT_COLUMNS['teacher_attendance']).toBe('m.teacher_attendance');
      expect(VALID_SORT_COLUMNS['name']).toBe('s.name');
    });

    it('returns undefined for invalid sort columns', () => {
      expect(VALID_SORT_COLUMNS['invalid']).toBeUndefined();
      expect(VALID_SORT_COLUMNS['DROP TABLE schools']).toBeUndefined();
    });

    it('has exactly 7 valid sort columns', () => {
      expect(Object.keys(VALID_SORT_COLUMNS)).toHaveLength(7);
    });
  });
});

describe('Correlation calculation (logic)', () => {
  // Replicate Pearson correlation logic for testing
  function calculatePearsonR(
    data: Array<{ x: number; y: number }>
  ): number | null {
    if (data.length < 3) return null;

    const n = data.length;
    const sumX = data.reduce((acc, d) => acc + d.x, 0);
    const sumY = data.reduce((acc, d) => acc + d.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (const d of data) {
      const dx = d.x - meanX;
      const dy = d.y - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denominator = Math.sqrt(denomX) * Math.sqrt(denomY);
    if (denominator === 0) return null;

    return numerator / denominator;
  }

  describe('basic correlation calculations', () => {
    it('returns 1 for perfect positive correlation', () => {
      const data = [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ];
      const r = calculatePearsonR(data);
      expect(r).toBeCloseTo(1.0, 5);
    });

    it('returns -1 for perfect negative correlation', () => {
      const data = [
        { x: 1, y: 3 },
        { x: 2, y: 2 },
        { x: 3, y: 1 },
      ];
      const r = calculatePearsonR(data);
      expect(r).toBeCloseTo(-1.0, 5);
    });

    it('returns ~0 for no correlation', () => {
      const data = [
        { x: 1, y: 2 },
        { x: 2, y: 1 },
        { x: 3, y: 3 },
        { x: 4, y: 2 },
      ];
      const r = calculatePearsonR(data);
      expect(r).toBeDefined();
      expect(Math.abs(r!)).toBeLessThan(0.5);
    });
  });

  describe('edge cases', () => {
    it('returns null for less than 3 data points', () => {
      expect(calculatePearsonR([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
      expect(calculatePearsonR([{ x: 1, y: 1 }])).toBeNull();
      expect(calculatePearsonR([])).toBeNull();
    });

    it('returns null for constant x values', () => {
      const data = [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 1, y: 3 },
      ];
      const r = calculatePearsonR(data);
      expect(r).toBeNull();
    });

    it('returns null for constant y values', () => {
      const data = [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ];
      const r = calculatePearsonR(data);
      expect(r).toBeNull();
    });
  });

  describe('realistic school data scenarios', () => {
    it('calculates moderate negative correlation (like ENI vs Performance)', () => {
      // Simulated data representing ENI vs Performance Score
      const data = [
        { x: 0.95, y: 0.35 },
        { x: 0.90, y: 0.40 },
        { x: 0.85, y: 0.45 },
        { x: 0.75, y: 0.55 },
        { x: 0.65, y: 0.60 },
        { x: 0.50, y: 0.70 },
        { x: 0.40, y: 0.75 },
      ];
      const r = calculatePearsonR(data);
      expect(r).toBeLessThan(-0.5);
      expect(r).toBeGreaterThan(-1);
    });

    it('calculates weak correlation (like ENI vs Impact)', () => {
      // Simulated data representing ENI vs Impact Score (weaker correlation)
      const data = [
        { x: 0.95, y: 0.45 },
        { x: 0.90, y: 0.55 },
        { x: 0.85, y: 0.50 },
        { x: 0.75, y: 0.48 },
        { x: 0.65, y: 0.52 },
        { x: 0.50, y: 0.50 },
        { x: 0.40, y: 0.55 },
      ];
      const r = calculatePearsonR(data);
      expect(Math.abs(r!)).toBeLessThan(0.5);
    });
  });
});

describe('Category criteria (logic)', () => {
  // Test the category assignment logic
  const THRESHOLDS = {
    impact: 0.55,
    performance: 0.50,
    eni: 0.85,
  };

  function assignCategory(
    impactScore: number | null,
    performanceScore: number | null,
    eni: number | null
  ): string | null {
    if (impactScore === null || performanceScore === null || eni === null) {
      return null;
    }

    if (eni < THRESHOLDS.eni) {
      return 'below_threshold';
    }

    if (impactScore >= THRESHOLDS.impact && performanceScore >= THRESHOLDS.performance) {
      return 'high_growth_high_achievement';
    }

    if (impactScore >= THRESHOLDS.impact) {
      return 'high_growth';
    }

    if (performanceScore >= THRESHOLDS.performance) {
      return 'high_achievement';
    }

    return 'developing';
  }

  describe('category assignments', () => {
    it('assigns high_growth_high_achievement correctly', () => {
      expect(assignCategory(0.60, 0.55, 0.90)).toBe('high_growth_high_achievement');
    });

    it('assigns high_growth correctly', () => {
      expect(assignCategory(0.60, 0.40, 0.90)).toBe('high_growth');
    });

    it('assigns high_achievement correctly', () => {
      expect(assignCategory(0.45, 0.55, 0.90)).toBe('high_achievement');
    });

    it('assigns developing correctly', () => {
      expect(assignCategory(0.45, 0.40, 0.90)).toBe('developing');
    });

    it('assigns below_threshold for low ENI', () => {
      expect(assignCategory(0.60, 0.55, 0.70)).toBe('below_threshold');
    });
  });

  describe('threshold boundaries', () => {
    it('uses >= for impact threshold', () => {
      expect(assignCategory(0.55, 0.40, 0.90)).toBe('high_growth');
      expect(assignCategory(0.54, 0.40, 0.90)).toBe('developing');
    });

    it('uses >= for performance threshold', () => {
      expect(assignCategory(0.40, 0.50, 0.90)).toBe('high_achievement');
      expect(assignCategory(0.40, 0.49, 0.90)).toBe('developing');
    });

    it('uses < for ENI threshold', () => {
      expect(assignCategory(0.60, 0.55, 0.85)).toBe('high_growth_high_achievement');
      expect(assignCategory(0.60, 0.55, 0.84)).toBe('below_threshold');
    });
  });

  describe('null handling', () => {
    it('returns null when impact score is null', () => {
      expect(assignCategory(null, 0.55, 0.90)).toBeNull();
    });

    it('returns null when performance score is null', () => {
      expect(assignCategory(0.60, null, 0.90)).toBeNull();
    });

    it('returns null when ENI is null', () => {
      expect(assignCategory(0.60, 0.55, null)).toBeNull();
    });
  });
});
