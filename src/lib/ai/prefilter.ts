import type { PrefilterResult } from '@/types/chat';

/**
 * Pre-filter patterns for fast rejection of harmful queries.
 * This runs BEFORE calling Claude API to save cost and latency.
 */

interface BlockPattern {
  pattern: RegExp;
  response: string;
}

interface FlagPattern {
  pattern: RegExp;
  prepend: string;
}

// Hard block patterns - return reframe immediately
const BLOCK_PATTERNS: BlockPattern[] = [
  {
    pattern: /rank.{0,20}(?:best|worst|top|bottom).{0,20}school/i,
    response: "I can't rank schools 'best to worst' because school quality depends on what you're looking for. I can help you find schools with high student growth, strong programs, or specific characteristics. What matters most to you?"
  },
  {
    pattern: /(?:schools?|places?).{0,15}(?:to\s+)?avoid/i,
    response: "I don't identify schools to 'avoid' because that framing can harm communities. I can help you understand what different schools offer and find ones that match criteria you value. What are you looking for?"
  },
  {
    pattern: /(?:lowest?|fewest?|least|highest?|most).{0,10}(?:percent|%|percentage).{0,10}(?:black|white|hispanic|latino|asian|african)/i,
    response: "I can't filter schools by demographic percentages as that can enable discriminatory school selection. I can help you explore schools by educational characteristics—programs, growth metrics, size, location. What aspects interest you?"
  },
  {
    pattern: /worst\s+school/i,
    response: "I don't label schools as 'worst.' Schools serving high-poverty communities face systemic challenges that test scores reflect. I can help you understand what factors affect outcomes or find schools with specific characteristics. What would be helpful?"
  },
  {
    pattern: /(?:failing|failed)\s+school/i,
    response: "I avoid the term 'failing schools' because it can stigmatize communities facing systemic challenges. I can help you explore schools that need support and the factors affecting their outcomes. What would you like to understand?"
  },
  {
    pattern: /(?:segregat|white.*neighborhood|avoid.*area)/i,
    response: "I can't help with queries that may reinforce segregation patterns. I can help you explore schools by educational programs, student growth, and other characteristics. What matters to you in a school?"
  },
  {
    pattern: /(?:good|safe)\s+(?:neighborhood|area)\s+school/i,
    response: "I focus on educational characteristics rather than neighborhood perceptions, which can reflect biased assumptions. I can help you find schools with strong student growth, family satisfaction, or specific programs. What educational qualities are you looking for?"
  }
];

// Soft flag patterns - allow but add context
const FLAG_PATTERNS: FlagPattern[] = [
  {
    pattern: /best\s+school/i,
    prepend: "Note: 'Best' depends on what you're looking for—student growth, programs, size, or location. I'll help you explore options based on specific criteria.\n\n"
  },
  {
    pattern: /prove|proof|evidence\s+that/i,
    prepend: "Note: This data can show patterns and correlations, but cannot prove causation. I'll share what we can observe.\n\n"
  },
  {
    pattern: /why\s+(?:do|does|are)\s+(?:poor|low.income|poverty)/i,
    prepend: "Note: Questions about poverty and school outcomes involve systemic factors. I'll share what the data shows alongside important context.\n\n"
  },
  {
    pattern: /charter.*better|better.*charter/i,
    prepend: "Note: Charter vs. traditional public comparisons require careful context—selection effects, different resources, and data gaps make direct comparisons difficult. I'll share what we can observe.\n\n"
  }
];

/**
 * Check if a query should be blocked or flagged.
 *
 * @param query - The user's query text
 * @returns PrefilterResult with blocked status and optional reframe
 */
export function checkPrefilter(query: string): PrefilterResult {
  // Check block patterns first
  for (const { pattern, response } of BLOCK_PATTERNS) {
    if (pattern.test(query)) {
      return {
        blocked: true,
        reframe: response
      };
    }
  }

  // Check flag patterns
  for (const { pattern, prepend } of FLAG_PATTERNS) {
    if (pattern.test(query)) {
      return {
        blocked: false,
        flag: prepend
      };
    }
  }

  // Query passes pre-filter
  return { blocked: false };
}

/**
 * Get all block patterns for testing purposes.
 */
export function getBlockPatterns(): BlockPattern[] {
  return BLOCK_PATTERNS;
}

/**
 * Get all flag patterns for testing purposes.
 */
export function getFlagPatterns(): FlagPattern[] {
  return FLAG_PATTERNS;
}
