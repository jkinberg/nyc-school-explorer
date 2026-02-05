import { describe, it, expect } from 'vitest';
import {
  calculateWeightedScore,
  shouldFlagResponse,
  getConfidenceBadge,
} from '../evaluation';
import type { EvaluationResult } from '@/types/chat';

describe('calculateWeightedScore', () => {
  describe('perfect scores', () => {
    it('returns 100 for all 5s', () => {
      const scores = {
        factual_accuracy: 5,
        context_inclusion: 5,
        limitation_acknowledgment: 5,
        responsible_framing: 5,
        query_relevance: 5,
      };
      expect(calculateWeightedScore(scores)).toBe(100);
    });
  });

  describe('minimum scores', () => {
    it('returns 0 for all 1s', () => {
      const scores = {
        factual_accuracy: 1,
        context_inclusion: 1,
        limitation_acknowledgment: 1,
        responsible_framing: 1,
        query_relevance: 1,
      };
      // With critical failure penalty: min is 35 because factual_accuracy = 1
      expect(calculateWeightedScore(scores)).toBe(0);
    });
  });

  describe('weighted calculation', () => {
    it('applies correct weights (25%, 20%, 20%, 20%, 15%)', () => {
      // Test that weights are applied correctly
      // Weights: factual=25, context=20, limitation=20, framing=20, relevance=15

      // Score of 3 on all = (3*25 + 3*20 + 3*20 + 3*20 + 3*15) = 3*100 = 300
      // Normalized: (300 - 100) / 4 = 50
      const allThrees = {
        factual_accuracy: 3,
        context_inclusion: 3,
        limitation_acknowledgment: 3,
        responsible_framing: 3,
        query_relevance: 3,
      };
      expect(calculateWeightedScore(allThrees)).toBe(50);
    });

    it('weights factual_accuracy higher than others', () => {
      // High factual accuracy vs high other metrics
      const highFactual = {
        factual_accuracy: 5,
        context_inclusion: 3,
        limitation_acknowledgment: 3,
        responsible_framing: 3,
        query_relevance: 3,
      };

      const highContext = {
        factual_accuracy: 3,
        context_inclusion: 5,
        limitation_acknowledgment: 3,
        responsible_framing: 3,
        query_relevance: 3,
      };

      // factual has 25% weight vs context's 20%
      expect(calculateWeightedScore(highFactual)).toBeGreaterThan(calculateWeightedScore(highContext));
    });
  });

  describe('critical failure penalty', () => {
    it('caps score at 35 when factual_accuracy is 1', () => {
      const fabricated = {
        factual_accuracy: 1,
        context_inclusion: 5,
        limitation_acknowledgment: 5,
        responsible_framing: 5,
        query_relevance: 5,
      };
      // Without penalty would be: (1*25 + 5*20 + 5*20 + 5*20 + 5*15) = 25 + 100 + 100 + 100 + 75 = 400
      // Normalized: (400 - 100) / 4 = 75
      // But with penalty: capped at 35
      expect(calculateWeightedScore(fabricated)).toBe(35);
    });

    it('caps score at 55 when factual_accuracy is 2', () => {
      const majorErrors = {
        factual_accuracy: 2,
        context_inclusion: 5,
        limitation_acknowledgment: 5,
        responsible_framing: 5,
        query_relevance: 5,
      };
      // Without penalty would be: (2*25 + 5*20 + 5*20 + 5*20 + 5*15) = 50 + 100 + 100 + 100 + 75 = 425
      // Normalized: (425 - 100) / 4 = 81.25 ≈ 81
      // But with penalty: capped at 55
      expect(calculateWeightedScore(majorErrors)).toBe(55);
    });

    it('does not apply penalty for factual_accuracy >= 3', () => {
      const goodFactual = {
        factual_accuracy: 3,
        context_inclusion: 5,
        limitation_acknowledgment: 5,
        responsible_framing: 5,
        query_relevance: 5,
      };
      // (3*25 + 5*20 + 5*20 + 5*20 + 5*15) = 75 + 100 + 100 + 100 + 75 = 450
      // Normalized: (450 - 100) / 4 = 87.5 ≈ 88
      expect(calculateWeightedScore(goodFactual)).toBe(88);
    });
  });

  describe('edge cases', () => {
    it('handles missing scores (defaults to 1)', () => {
      const partial = {
        factual_accuracy: 5,
        context_inclusion: 5,
      } as EvaluationResult['scores'];

      // Missing scores default to 1
      // The function uses || 1 for missing scores
      const result = calculateWeightedScore(partial);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });
});

describe('shouldFlagResponse', () => {
  describe('weighted score threshold', () => {
    it('flags responses with weighted_score < 60', () => {
      const lowScore: EvaluationResult = {
        scores: {
          factual_accuracy: 3,
          context_inclusion: 3,
          limitation_acknowledgment: 3,
          responsible_framing: 3,
          query_relevance: 3,
        },
        flags: [],
        summary: 'Average response',
        weighted_score: 59,
      };
      expect(shouldFlagResponse(lowScore)).toBe(true);
    });

    it('does not flag responses with weighted_score >= 60', () => {
      const okScore: EvaluationResult = {
        scores: {
          factual_accuracy: 4,
          context_inclusion: 4,
          limitation_acknowledgment: 4,
          responsible_framing: 4,
          query_relevance: 4,
        },
        flags: [],
        summary: 'Good response',
        weighted_score: 75,
      };
      expect(shouldFlagResponse(okScore)).toBe(false);
    });
  });

  describe('individual dimension thresholds', () => {
    it('flags when factual_accuracy <= 2', () => {
      const lowFactual: EvaluationResult = {
        scores: {
          factual_accuracy: 2,
          context_inclusion: 5,
          limitation_acknowledgment: 5,
          responsible_framing: 5,
          query_relevance: 5,
        },
        flags: [],
        summary: 'Major factual errors',
        weighted_score: 75, // Would pass score threshold
      };
      expect(shouldFlagResponse(lowFactual)).toBe(true);
    });

    it('flags when responsible_framing <= 2', () => {
      const badFraming: EvaluationResult = {
        scores: {
          factual_accuracy: 5,
          context_inclusion: 5,
          limitation_acknowledgment: 5,
          responsible_framing: 2,
          query_relevance: 5,
        },
        flags: [],
        summary: 'Problematic framing',
        weighted_score: 80,
      };
      expect(shouldFlagResponse(badFraming)).toBe(true);
    });

    it('does not flag for low context_inclusion alone', () => {
      const lowContext: EvaluationResult = {
        scores: {
          factual_accuracy: 4,
          context_inclusion: 2,
          limitation_acknowledgment: 4,
          responsible_framing: 4,
          query_relevance: 4,
        },
        flags: [],
        summary: 'Missing context',
        weighted_score: 70,
      };
      expect(shouldFlagResponse(lowContext)).toBe(false);
    });
  });

  describe('flags array', () => {
    it('flags when there are specific concerns', () => {
      const hasFlags: EvaluationResult = {
        scores: {
          factual_accuracy: 4,
          context_inclusion: 4,
          limitation_acknowledgment: 4,
          responsible_framing: 4,
          query_relevance: 4,
        },
        flags: ['Mentioned unverified data source'],
        summary: 'Good but has concerns',
        weighted_score: 75,
      };
      expect(shouldFlagResponse(hasFlags)).toBe(true);
    });

    it('does not flag for empty flags array', () => {
      const noFlags: EvaluationResult = {
        scores: {
          factual_accuracy: 4,
          context_inclusion: 4,
          limitation_acknowledgment: 4,
          responsible_framing: 4,
          query_relevance: 4,
        },
        flags: [],
        summary: 'Clean response',
        weighted_score: 75,
      };
      expect(shouldFlagResponse(noFlags)).toBe(false);
    });

    it('handles undefined flags', () => {
      const undefinedFlags: EvaluationResult = {
        scores: {
          factual_accuracy: 4,
          context_inclusion: 4,
          limitation_acknowledgment: 4,
          responsible_framing: 4,
          query_relevance: 4,
        },
        flags: undefined as unknown as string[],
        summary: 'Response',
        weighted_score: 75,
      };
      expect(shouldFlagResponse(undefinedFlags)).toBe(false);
    });
  });
});

describe('getConfidenceBadge', () => {
  describe('high confidence (90+)', () => {
    it('returns high badge for score >= 90', () => {
      const badge = getConfidenceBadge(90);
      expect(badge.level).toBe('high');
      expect(badge.label).toBe('High confidence');
      expect(badge.color).toBe('green');
    });

    it('returns high badge for score 100', () => {
      const badge = getConfidenceBadge(100);
      expect(badge.level).toBe('high');
    });
  });

  describe('verified (75-89)', () => {
    it('returns verified badge for score >= 75 and < 90', () => {
      const badge = getConfidenceBadge(75);
      expect(badge.level).toBe('verified');
      expect(badge.label).toBe('Verified');
      expect(badge.color).toBe('blue');
    });

    it('returns verified badge for score 89', () => {
      const badge = getConfidenceBadge(89);
      expect(badge.level).toBe('verified');
    });
  });

  describe('review suggested (60-74)', () => {
    it('returns review_suggested badge for score >= 60 and < 75', () => {
      const badge = getConfidenceBadge(60);
      expect(badge.level).toBe('review_suggested');
      expect(badge.label).toBe('Review suggested');
      expect(badge.color).toBe('yellow');
    });

    it('returns review_suggested badge for score 74', () => {
      const badge = getConfidenceBadge(74);
      expect(badge.level).toBe('review_suggested');
    });
  });

  describe('low confidence (< 60)', () => {
    it('returns low badge for score < 60', () => {
      const badge = getConfidenceBadge(59);
      expect(badge.level).toBe('low');
      expect(badge.label).toBe('Low confidence');
      expect(badge.color).toBe('red');
    });

    it('returns low badge for score 0', () => {
      const badge = getConfidenceBadge(0);
      expect(badge.level).toBe('low');
    });
  });

  describe('boundary cases', () => {
    it('correctly categorizes score of exactly 90', () => {
      expect(getConfidenceBadge(90).level).toBe('high');
    });

    it('correctly categorizes score of exactly 75', () => {
      expect(getConfidenceBadge(75).level).toBe('verified');
    });

    it('correctly categorizes score of exactly 60', () => {
      expect(getConfidenceBadge(60).level).toBe('review_suggested');
    });
  });
});
