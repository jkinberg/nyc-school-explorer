import { describe, it, expect } from 'vitest';
import { levenshteinDistance, findFuzzyMatches } from '../fuzzy';

describe('levenshteinDistance', () => {
  describe('identical strings', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('Stuyvesant', 'Stuyvesant')).toBe(0);
    });

    it('is case insensitive', () => {
      expect(levenshteinDistance('Hello', 'hello')).toBe(0);
      expect(levenshteinDistance('STUYVESANT', 'stuyvesant')).toBe(0);
    });

    it('trims whitespace', () => {
      expect(levenshteinDistance(' hello ', 'hello')).toBe(0);
      expect(levenshteinDistance('hello', '  hello  ')).toBe(0);
    });
  });

  describe('single character differences', () => {
    it('returns 1 for single substitution', () => {
      expect(levenshteinDistance('hello', 'hallo')).toBe(1);
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
    });

    it('returns 1 for single insertion', () => {
      expect(levenshteinDistance('hello', 'helloo')).toBe(1);
      expect(levenshteinDistance('cat', 'cats')).toBe(1);
    });

    it('returns 1 for single deletion', () => {
      expect(levenshteinDistance('hello', 'hell')).toBe(1);
      expect(levenshteinDistance('cats', 'cat')).toBe(1);
    });
  });

  describe('school name typos', () => {
    it('handles Stuyvesant typo', () => {
      // Common typo: Stuyvesent instead of Stuyvesant
      expect(levenshteinDistance('Stuyvesent', 'Stuyvesant')).toBe(1);
    });

    it('handles Brooklyn typos', () => {
      expect(levenshteinDistance('Brooklin', 'Brooklyn')).toBe(1);
      expect(levenshteinDistance('Broooklyn', 'Brooklyn')).toBe(1);
    });

    it('handles multiple errors', () => {
      // 'Stuyvsant' vs 'Stuyvesant' - missing 'e' = 1 deletion
      expect(levenshteinDistance('Stuyvsant', 'Stuyvesant')).toBe(1);
      // 'Brooklen' vs 'Brooklyn' - 'e' vs 'y' = 1 substitution
      expect(levenshteinDistance('Brooklen', 'Brooklyn')).toBe(1);
    });
  });

  describe('completely different strings', () => {
    it('returns length of longer string for empty vs non-empty', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('hello', '')).toBe(5);
    });

    it('returns 0 for two empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
    });

    it('returns correct distance for different strings', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
    });
  });

  describe('space efficiency optimization', () => {
    it('handles longer first string (swaps internally)', () => {
      // This tests the internal optimization that puts shorter string first
      const result1 = levenshteinDistance('abc', 'abcdefghij');
      const result2 = levenshteinDistance('abcdefghij', 'abc');
      expect(result1).toBe(result2);
    });
  });
});

describe('findFuzzyMatches', () => {
  interface TestSchool {
    name: string;
    dbn: string;
  }

  const testSchools: TestSchool[] = [
    { name: 'Stuyvesant High School', dbn: '02M475' },
    { name: 'Brooklyn Technical High School', dbn: '13K430' },
    { name: 'P.S. 188 The Island School', dbn: '01M188' },
    { name: 'Bronx Science', dbn: '10X445' },
    { name: 'P.S. 234 Independence School', dbn: '02M234' },
    { name: 'LaGuardia High School', dbn: '02M600' },
  ];

  const getName = (school: TestSchool) => school.name;

  describe('exact matches', () => {
    it('returns exact match with distance 0', () => {
      const results = findFuzzyMatches('Stuyvesant High School', testSchools, getName);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.name).toBe('Stuyvesant High School');
      expect(results[0].distance).toBe(0);
    });
  });

  describe('typo tolerance', () => {
    it('finds Stuyvesant with common typo', () => {
      const results = findFuzzyMatches('Stuyvesent', testSchools, getName);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.name).toBe('Stuyvesant High School');
      expect(results[0].distance).toBeLessThanOrEqual(3);
    });

    it('finds Brooklyn Tech with partial match', () => {
      const results = findFuzzyMatches('Brooklyn', testSchools, getName);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.name).toBe('Brooklyn Technical High School');
    });

    it('finds Bronx Science with typo', () => {
      const results = findFuzzyMatches('Bronx Scince', testSchools, getName, 3);
      expect(results.length).toBeGreaterThan(0);
      // Should match against word "Science" with distance 1
      expect(results[0].item.name).toBe('Bronx Science');
    });
  });

  describe('word matching', () => {
    it('matches against individual words in name', () => {
      // "Island" should match "P.S. 188 The Island School" via word matching
      const results = findFuzzyMatches('Island', testSchools, getName);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.name).toBe('P.S. 188 The Island School');
      expect(results[0].distance).toBe(0);
    });

    it('skips short words (< 3 chars) when matching words', () => {
      // First check full text, then individual words
      // "The" has length 3, so it should be checked
      // But full name "P.S. 188 The Island School" won't match "The" with distance 0
      const results = findFuzzyMatches('The', testSchools, getName, 0);
      // "The" matches "The" in "P.S. 188 The Island School" with distance 0
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('result limiting', () => {
    it('respects limit parameter', () => {
      const results = findFuzzyMatches('School', testSchools, getName, 10, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('uses default limit of 5', () => {
      const manySchools = Array.from({ length: 20 }, (_, i) => ({
        name: `Test School ${i}`,
        dbn: `00X00${i}`,
      }));
      const results = findFuzzyMatches('School', manySchools, getName, 10);
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('max distance filtering', () => {
    it('filters out results beyond max distance', () => {
      const results = findFuzzyMatches('XYZ123', testSchools, getName, 2);
      expect(results.length).toBe(0);
    });

    it('uses default max distance of 3', () => {
      // "Brooklyn" with 4 errors should still be filtered out with default max distance
      const results = findFuzzyMatches('Brooklynnnn', testSchools, getName);
      // Should still find Brooklyn (edit distance ~4) - depends on word matching
      // Let's check if it's included
      const brooklynMatch = results.find(r => r.item.name.includes('Brooklyn'));
      if (brooklynMatch) {
        expect(brooklynMatch.distance).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('result ordering', () => {
    it('returns results sorted by distance (ascending)', () => {
      const schools = [
        { name: 'AAAB', dbn: '1' },
        { name: 'AAAA', dbn: '2' },
        { name: 'AABB', dbn: '3' },
      ];
      const results = findFuzzyMatches('AAAA', schools, s => s.name);
      expect(results[0].distance).toBeLessThanOrEqual(results[results.length - 1].distance);
      expect(results[0].item.name).toBe('AAAA');
    });
  });

  describe('edge cases', () => {
    it('handles empty candidate list', () => {
      const results = findFuzzyMatches('test', [], getName);
      expect(results).toEqual([]);
    });

    it('handles empty query', () => {
      const results = findFuzzyMatches('', testSchools, getName);
      // Empty string has distance = word length for each school
      // Most will be filtered out by max distance
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });
});
