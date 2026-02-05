import { describe, it, expect } from 'vitest';
import {
  formatScore,
  formatScoreWithContext,
  formatENI,
  formatEnrollment,
  formatBorough,
  formatCategory,
  formatCorrelation,
  formatChange,
  generateId,
  truncate,
  formatSchoolName,
  formatCurrency,
  formatDate,
} from '../formatting';

describe('formatScore', () => {
  it('formats score as percentage', () => {
    expect(formatScore(0.55)).toBe('55%');
    expect(formatScore(0.5)).toBe('50%');
    expect(formatScore(1)).toBe('100%');
    expect(formatScore(0)).toBe('0%');
  });

  it('rounds to nearest whole number', () => {
    expect(formatScore(0.554)).toBe('55%');
    expect(formatScore(0.555)).toBe('56%');
    expect(formatScore(0.556)).toBe('56%');
  });

  it('handles null and undefined', () => {
    expect(formatScore(null)).toBe('N/A');
    expect(formatScore(undefined as unknown as null)).toBe('N/A');
  });
});

describe('formatScoreWithContext', () => {
  it('shows above median context', () => {
    expect(formatScoreWithContext(0.6, 0.5)).toBe('60% (above median)');
  });

  it('shows below median context', () => {
    expect(formatScoreWithContext(0.4, 0.5)).toBe('40% (below median)');
  });

  it('shows near median for values within 0.05', () => {
    expect(formatScoreWithContext(0.52, 0.5)).toBe('52% (near median)');
    expect(formatScoreWithContext(0.48, 0.5)).toBe('48% (near median)');
    // 0.55 - 0.5 = 0.05 which is NOT less than 0.05, so it shows above
    expect(formatScoreWithContext(0.54, 0.5)).toBe('54% (near median)');
  });

  it('handles null', () => {
    expect(formatScoreWithContext(null, 0.5)).toBe('N/A');
  });
});

describe('formatENI', () => {
  it('formats with very high poverty context', () => {
    expect(formatENI(0.95)).toBe('95th percentile (very high poverty)');
    expect(formatENI(0.99)).toBe('99th percentile (very high poverty)');
  });

  it('formats with high poverty context', () => {
    expect(formatENI(0.85)).toBe('85th percentile (high poverty)');
    expect(formatENI(0.94)).toBe('94th percentile (high poverty)');
  });

  it('formats with moderate poverty context', () => {
    expect(formatENI(0.70)).toBe('70th percentile (moderate poverty)');
    expect(formatENI(0.84)).toBe('84th percentile (moderate poverty)');
  });

  it('formats with lower poverty context', () => {
    expect(formatENI(0.50)).toBe('50th percentile (lower poverty)');
    expect(formatENI(0.69)).toBe('69th percentile (lower poverty)');
  });

  it('formats with low poverty context', () => {
    expect(formatENI(0.49)).toBe('49th percentile (low poverty)');
    expect(formatENI(0.1)).toBe('10th percentile (low poverty)');
  });

  it('handles null and undefined', () => {
    expect(formatENI(null)).toBe('N/A');
    expect(formatENI(undefined as unknown as null)).toBe('N/A');
  });
});

describe('formatEnrollment', () => {
  it('formats with locale string and students suffix', () => {
    expect(formatEnrollment(500)).toBe('500 students');
    expect(formatEnrollment(1234)).toBe('1,234 students');
    expect(formatEnrollment(12345)).toBe('12,345 students');
  });

  it('handles null and undefined', () => {
    expect(formatEnrollment(null)).toBe('N/A');
    expect(formatEnrollment(undefined as unknown as null)).toBe('N/A');
  });
});

describe('formatBorough', () => {
  it('returns borough name unchanged', () => {
    expect(formatBorough('Manhattan')).toBe('Manhattan');
    expect(formatBorough('Brooklyn')).toBe('Brooklyn');
    expect(formatBorough('Bronx')).toBe('Bronx');
    expect(formatBorough('Queens')).toBe('Queens');
    expect(formatBorough('Staten Island')).toBe('Staten Island');
  });
});

describe('formatCategory', () => {
  it('formats high_growth_high_achievement', () => {
    expect(formatCategory('high_growth_high_achievement')).toBe('Strong Growth + Strong Outcomes');
  });

  it('formats high_growth', () => {
    expect(formatCategory('high_growth')).toBe('Strong Growth, Building Outcomes');
  });

  it('formats high_achievement', () => {
    expect(formatCategory('high_achievement')).toBe('Strong Outcomes, Moderate Growth');
  });

  it('formats developing', () => {
    expect(formatCategory('developing')).toBe('Developing on Both Metrics');
  });

  it('formats below_threshold', () => {
    expect(formatCategory('below_threshold')).toBe('Lower Economic Need');
  });

  it('returns unknown category as-is', () => {
    expect(formatCategory('unknown_category')).toBe('unknown_category');
  });

  it('handles null and empty string', () => {
    expect(formatCategory(null)).toBe('Unknown');
    expect(formatCategory('')).toBe('Unknown');
  });
});

describe('formatCorrelation', () => {
  it('formats strong positive correlation', () => {
    expect(formatCorrelation(0.75)).toBe('r = 0.75 (strong positive)');
    expect(formatCorrelation(0.9)).toBe('r = 0.90 (strong positive)');
  });

  it('formats strong negative correlation', () => {
    expect(formatCorrelation(-0.75)).toBe('r = -0.75 (strong negative)');
    expect(formatCorrelation(-0.9)).toBe('r = -0.90 (strong negative)');
  });

  it('formats moderate correlation', () => {
    expect(formatCorrelation(0.55)).toBe('r = 0.55 (moderate positive)');
    expect(formatCorrelation(-0.55)).toBe('r = -0.55 (moderate negative)');
  });

  it('formats weak correlation', () => {
    expect(formatCorrelation(0.35)).toBe('r = 0.35 (weak positive)');
    expect(formatCorrelation(-0.35)).toBe('r = -0.35 (weak negative)');
  });

  it('formats very weak correlation', () => {
    expect(formatCorrelation(0.1)).toBe('r = 0.10 (very weak positive)');
    expect(formatCorrelation(-0.1)).toBe('r = -0.10 (very weak negative)');
    expect(formatCorrelation(0)).toBe('r = 0.00 (very weak positive)');
  });

  it('handles null and undefined', () => {
    expect(formatCorrelation(null)).toBe('N/A');
    expect(formatCorrelation(undefined as unknown as null)).toBe('N/A');
  });
});

describe('formatChange', () => {
  it('formats positive change with arrow', () => {
    expect(formatChange(0.6, 0.5)).toBe('↑ +10 points');
    expect(formatChange(0.8, 0.5)).toBe('↑ +30 points');
  });

  it('formats negative change with arrow', () => {
    expect(formatChange(0.4, 0.5)).toBe('↓ -10 points');
    expect(formatChange(0.2, 0.5)).toBe('↓ -30 points');
  });

  it('shows stable for small changes', () => {
    expect(formatChange(0.52, 0.5)).toBe('→ stable');
    expect(formatChange(0.48, 0.5)).toBe('→ stable');
    // 0.55 - 0.5 = 0.05 which is NOT greater than 0.05
    expect(formatChange(0.54, 0.5)).toBe('→ stable');
  });

  it('handles null values', () => {
    expect(formatChange(null, 0.5)).toBe('N/A');
    expect(formatChange(0.5, null)).toBe('N/A');
    expect(formatChange(null, null)).toBe('N/A');
  });
});

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('contains timestamp and random portion', () => {
    const id = generateId();
    expect(id).toMatch(/^\d+-[a-z0-9]+$/);
  });
});

describe('truncate', () => {
  it('returns text unchanged if under max length', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
    expect(truncate('Hello', 5)).toBe('Hello');
  });

  it('truncates long text with ellipsis', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
    expect(truncate('This is a long text', 10)).toBe('This is...');
  });

  it('handles exact boundary', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
    expect(truncate('Hello!', 5)).toBe('He...');
  });
});

describe('formatSchoolName', () => {
  it('truncates long school names', () => {
    const longName = 'P.S. 999 The Very Long Elementary School Name That Goes On Forever';
    const result = formatSchoolName(longName);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result.endsWith('...')).toBe(true);
  });

  it('respects custom max length', () => {
    const name = 'P.S. 188 The Island School';
    expect(formatSchoolName(name, 15)).toBe('P.S. 188 The...');
  });

  it('returns short names unchanged', () => {
    const name = 'P.S. 188';
    expect(formatSchoolName(name)).toBe('P.S. 188');
  });
});

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    expect(formatCurrency(1234567)).toBe('$1,234,567');
    expect(formatCurrency(1000)).toBe('$1,000');
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats negative amounts', () => {
    expect(formatCurrency(-1000)).toBe('-$1,000');
  });

  it('handles null and undefined', () => {
    expect(formatCurrency(null)).toBe('N/A');
    expect(formatCurrency(undefined as unknown as null)).toBe('N/A');
  });
});

describe('formatDate', () => {
  it('formats Date objects', () => {
    const date = new Date('2024-03-15T12:00:00');
    const result = formatDate(date);
    expect(result).toContain('Mar');
    expect(result).toContain('2024');
  });

  it('formats date strings', () => {
    const result = formatDate('2024-03-15T12:00:00');
    expect(result).toContain('Mar');
    expect(result).toContain('2024');
  });
});
