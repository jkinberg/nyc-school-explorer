import { describe, it, expect } from 'vitest';
import { checkPrefilter, getBlockPatterns, getFlagPatterns } from '../prefilter';

describe('checkPrefilter', () => {
  describe('block patterns', () => {
    describe('ranking queries', () => {
      it('blocks "rank best schools"', () => {
        const result = checkPrefilter('Can you rank the best schools in NYC?');
        expect(result.blocked).toBe(true);
        expect(result.reframe).toBeDefined();
        expect(result.reframe).toContain('rank');
      });

      it('blocks "rank worst schools"', () => {
        const result = checkPrefilter('Rank the worst schools in Brooklyn');
        expect(result.blocked).toBe(true);
      });

      it('blocks "rank top schools"', () => {
        // Pattern requires "rank" before "top/bottom/best/worst" + "school"
        const result = checkPrefilter('Can you rank the top schools?');
        expect(result.blocked).toBe(true);
      });

      it('blocks "rank bottom schools"', () => {
        const result = checkPrefilter('rank the bottom schools in NYC');
        expect(result.blocked).toBe(true);
      });
    });

    describe('schools to avoid', () => {
      it('blocks "schools to avoid"', () => {
        const result = checkPrefilter('Which schools should I avoid?');
        expect(result.blocked).toBe(true);
        expect(result.reframe).toContain('avoid');
      });

      it('blocks "places to avoid"', () => {
        const result = checkPrefilter('What places to avoid for schools?');
        expect(result.blocked).toBe(true);
      });

      it('blocks "school avoid"', () => {
        const result = checkPrefilter('Tell me which school to avoid');
        expect(result.blocked).toBe(true);
      });
    });

    describe('demographic percentage filtering', () => {
      it('blocks lowest percent black', () => {
        const result = checkPrefilter('Schools with lowest percent black students');
        expect(result.blocked).toBe(true);
        expect(result.reframe).toContain('demographic');
      });

      it('blocks highest percentage hispanic', () => {
        const result = checkPrefilter('Which schools have highest percentage hispanic?');
        expect(result.blocked).toBe(true);
      });

      it('blocks most % asian', () => {
        const result = checkPrefilter('Schools with most % asian students');
        expect(result.blocked).toBe(true);
      });

      it('blocks fewest percent white', () => {
        const result = checkPrefilter('Schools with fewest percent white');
        expect(result.blocked).toBe(true);
      });

      it('blocks least percentage african', () => {
        const result = checkPrefilter('Least percentage african american');
        expect(result.blocked).toBe(true);
      });

      it('blocks highest percent latino', () => {
        const result = checkPrefilter('Highest percent latino schools');
        expect(result.blocked).toBe(true);
      });
    });

    describe('worst school queries', () => {
      it('blocks "worst school"', () => {
        const result = checkPrefilter('What is the worst school in Queens?');
        expect(result.blocked).toBe(true);
        expect(result.reframe).toContain('worst');
      });

      it('blocks "worst schools"', () => {
        const result = checkPrefilter('Show me the worst schools');
        expect(result.blocked).toBe(true);
      });
    });

    describe('failing school queries', () => {
      it('blocks "failing school"', () => {
        const result = checkPrefilter('Which are the failing schools?');
        expect(result.blocked).toBe(true);
        expect(result.reframe).toContain('failing');
      });

      it('blocks "failed school"', () => {
        const result = checkPrefilter('Is this a failed school?');
        expect(result.blocked).toBe(true);
      });
    });

    describe('segregation and neighborhood queries', () => {
      it('blocks segregation queries', () => {
        const result = checkPrefilter('Help me find a segregated school');
        expect(result.blocked).toBe(true);
        expect(result.reframe).toContain('segregation');
      });

      it('blocks "white neighborhood school"', () => {
        const result = checkPrefilter('Schools in white neighborhoods');
        expect(result.blocked).toBe(true);
      });

      it('blocks "avoid area" with school context', () => {
        // Pattern /(?:segregat|white.*neighborhood|avoid.*area)/i
        const result = checkPrefilter('I want to avoid that area for schools');
        expect(result.blocked).toBe(true);
      });
    });

    describe('good/safe neighborhood queries', () => {
      it('blocks "good neighborhood school"', () => {
        const result = checkPrefilter('Find good neighborhood schools');
        expect(result.blocked).toBe(true);
        expect(result.reframe).toContain('neighborhood');
      });

      it('blocks "safe neighborhood school"', () => {
        // Pattern /(?:good|safe)\s+(?:neighborhood|area)\s+school/i
        const result = checkPrefilter('Find me a safe neighborhood school');
        expect(result.blocked).toBe(true);
      });
    });
  });

  describe('flag patterns (allowed with context)', () => {
    describe('best school queries', () => {
      it('flags "best school" with prepended context', () => {
        const result = checkPrefilter('What is the best school in Manhattan?');
        expect(result.blocked).toBe(false);
        expect(result.flag).toBeDefined();
        expect(result.flag).toContain('Best');
      });

      it('flags "best schools"', () => {
        const result = checkPrefilter('Show me the best schools');
        expect(result.blocked).toBe(false);
        expect(result.flag).toBeDefined();
      });
    });

    describe('proof/evidence queries', () => {
      it('flags "prove that"', () => {
        const result = checkPrefilter('Can you prove that charter schools are better?');
        expect(result.blocked).toBe(false);
        expect(result.flag).toBeDefined();
        expect(result.flag).toContain('prove');
      });

      it('flags "evidence that"', () => {
        const result = checkPrefilter('What is the evidence that poverty affects scores?');
        expect(result.blocked).toBe(false);
        expect(result.flag).toBeDefined();
      });

      it('flags "proof"', () => {
        const result = checkPrefilter('Show me proof of improvement');
        expect(result.blocked).toBe(false);
        expect(result.flag).toBeDefined();
      });
    });

    describe('poverty-related queries', () => {
      it('flags "why do poor schools"', () => {
        const result = checkPrefilter('Why do poor schools have lower scores?');
        expect(result.blocked).toBe(false);
        expect(result.flag).toBeDefined();
        expect(result.flag).toContain('poverty');
      });

      it('flags "why does low-income"', () => {
        const result = checkPrefilter('Why does low-income affect achievement?');
        expect(result.blocked).toBe(false);
        expect(result.flag).toBeDefined();
      });

      it('flags "why are poverty"', () => {
        const result = checkPrefilter('Why are poverty rates correlated?');
        expect(result.blocked).toBe(false);
        expect(result.flag).toBeDefined();
      });
    });

    describe('charter comparison queries', () => {
      it('flags "charter better"', () => {
        const result = checkPrefilter('Are charter schools better?');
        expect(result.blocked).toBe(false);
        expect(result.flag).toBeDefined();
        expect(result.flag).toContain('Charter');
      });

      it('flags "better charter"', () => {
        const result = checkPrefilter('Is a better charter school worth it?');
        expect(result.blocked).toBe(false);
        expect(result.flag).toBeDefined();
      });
    });
  });

  describe('legitimate queries (no block or flag)', () => {
    it('allows "high growth schools"', () => {
      const result = checkPrefilter('Show me high growth schools in Brooklyn');
      expect(result.blocked).toBe(false);
      expect(result.flag).toBeUndefined();
    });

    it('allows "schools with strong student growth"', () => {
      const result = checkPrefilter('Which schools have strong student growth?');
      expect(result.blocked).toBe(false);
      expect(result.flag).toBeUndefined();
    });

    it('allows demographic context questions', () => {
      const result = checkPrefilter('How does economic need affect scores?');
      expect(result.blocked).toBe(false);
      expect(result.flag).toBeUndefined();
    });

    it('allows specific school queries', () => {
      const result = checkPrefilter('Tell me about P.S. 188');
      expect(result.blocked).toBe(false);
      expect(result.flag).toBeUndefined();
    });

    it('allows category queries', () => {
      const result = checkPrefilter('Show me high achievement schools');
      expect(result.blocked).toBe(false);
      expect(result.flag).toBeUndefined();
    });

    it('allows correlation questions', () => {
      const result = checkPrefilter('What is the correlation between ENI and performance?');
      expect(result.blocked).toBe(false);
      expect(result.flag).toBeUndefined();
    });

    it('allows borough filtering', () => {
      const result = checkPrefilter('Schools in Manhattan with high impact scores');
      expect(result.blocked).toBe(false);
      expect(result.flag).toBeUndefined();
    });

    it('allows enrollment questions', () => {
      const result = checkPrefilter('What are the largest schools?');
      expect(result.blocked).toBe(false);
      expect(result.flag).toBeUndefined();
    });
  });

  describe('edge cases and false positives prevention', () => {
    it('does not block "ranked by impact score"', () => {
      // This mentions "rank" but in a different context
      const result = checkPrefilter('Show schools ranked by impact score');
      // This might match the rank pattern - let's verify the behavior
      // The pattern is /rank.{0,20}(?:best|worst|top|bottom).{0,20}school/i
      // "ranked by impact score" doesn't have best/worst/top/bottom
      expect(result.blocked).toBe(false);
    });

    it('does not block "improve schools"', () => {
      // Contains "school" but in a positive context
      const result = checkPrefilter('How can we improve schools?');
      expect(result.blocked).toBe(false);
    });

    it('does not block "worst performing metric"', () => {
      // Contains "worst" but not "worst school"
      const result = checkPrefilter('What is the worst performing metric?');
      expect(result.blocked).toBe(false);
    });

    it('does not block "percentage of students who..."', () => {
      // Contains "percentage" but not in demographic filtering context
      const result = checkPrefilter('What percentage of students improved?');
      expect(result.blocked).toBe(false);
    });

    it('handles empty query', () => {
      const result = checkPrefilter('');
      expect(result.blocked).toBe(false);
      expect(result.flag).toBeUndefined();
    });

    it('handles query with only whitespace', () => {
      const result = checkPrefilter('   ');
      expect(result.blocked).toBe(false);
    });
  });
});

describe('getBlockPatterns', () => {
  it('returns array of block patterns', () => {
    const patterns = getBlockPatterns();
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('each pattern has pattern and response', () => {
    const patterns = getBlockPatterns();
    for (const p of patterns) {
      expect(p.pattern).toBeInstanceOf(RegExp);
      expect(typeof p.response).toBe('string');
      expect(p.response.length).toBeGreaterThan(0);
    }
  });
});

describe('getFlagPatterns', () => {
  it('returns array of flag patterns', () => {
    const patterns = getFlagPatterns();
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('each pattern has pattern and prepend', () => {
    const patterns = getFlagPatterns();
    for (const p of patterns) {
      expect(p.pattern).toBeInstanceOf(RegExp);
      expect(typeof p.prepend).toBe('string');
      expect(p.prepend.length).toBeGreaterThan(0);
    }
  });
});
