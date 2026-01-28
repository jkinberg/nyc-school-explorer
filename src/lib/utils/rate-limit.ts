/**
 * Rate limiting utilities for the chat API.
 * Uses in-memory storage for development; consider Vercel KV or Redis for production.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit storage
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configuration
const RATE_LIMITS = {
  perMinute: 10,
  perHour: 100,
  dailyBudgetUSD: parseFloat(process.env.DAILY_BUDGET_USD || '50'),
};

// Token tracking for cost control
let tokensUsedToday = 0;
let tokenResetDate = new Date().toDateString();

// Approximate cost per 1M tokens (adjust based on actual pricing)
const COST_PER_MILLION_TOKENS = 3; // Conservative estimate for Sonnet

/**
 * Check if a request should be rate limited.
 *
 * @param identifier - Unique identifier (usually IP address)
 * @returns Object with allowed status and rate limit info
 */
export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  error?: string;
} {
  const now = Date.now();
  const minuteKey = `${identifier}:minute`;
  const hourKey = `${identifier}:hour`;

  // Check minute limit
  const minuteEntry = rateLimitStore.get(minuteKey);
  if (minuteEntry) {
    if (now < minuteEntry.resetAt) {
      if (minuteEntry.count >= RATE_LIMITS.perMinute) {
        return {
          allowed: false,
          remaining: 0,
          resetIn: Math.ceil((minuteEntry.resetAt - now) / 1000),
          error: 'Too many requests. Please wait a moment before trying again.'
        };
      }
    } else {
      // Reset expired entry
      rateLimitStore.delete(minuteKey);
    }
  }

  // Check hour limit
  const hourEntry = rateLimitStore.get(hourKey);
  if (hourEntry) {
    if (now < hourEntry.resetAt) {
      if (hourEntry.count >= RATE_LIMITS.perHour) {
        return {
          allowed: false,
          remaining: 0,
          resetIn: Math.ceil((hourEntry.resetAt - now) / 1000),
          error: 'Hourly limit reached. Please try again later.'
        };
      }
    } else {
      rateLimitStore.delete(hourKey);
    }
  }

  // Calculate remaining
  const minuteRemaining = RATE_LIMITS.perMinute - (minuteEntry?.count || 0) - 1;
  const hourRemaining = RATE_LIMITS.perHour - (hourEntry?.count || 0) - 1;

  return {
    allowed: true,
    remaining: Math.min(minuteRemaining, hourRemaining),
    resetIn: 60
  };
}

/**
 * Record a request for rate limiting.
 */
export function recordRequest(identifier: string): void {
  const now = Date.now();
  const minuteKey = `${identifier}:minute`;
  const hourKey = `${identifier}:hour`;

  // Update minute counter
  const minuteEntry = rateLimitStore.get(minuteKey);
  if (minuteEntry && now < minuteEntry.resetAt) {
    minuteEntry.count++;
  } else {
    rateLimitStore.set(minuteKey, {
      count: 1,
      resetAt: now + 60 * 1000
    });
  }

  // Update hour counter
  const hourEntry = rateLimitStore.get(hourKey);
  if (hourEntry && now < hourEntry.resetAt) {
    hourEntry.count++;
  } else {
    rateLimitStore.set(hourKey, {
      count: 1,
      resetAt: now + 60 * 60 * 1000
    });
  }
}

/**
 * Check if we're within daily budget.
 */
export function checkDailyBudget(): {
  allowed: boolean;
  tokensUsed: number;
  estimatedCost: number;
  budgetRemaining: number;
} {
  // Reset daily counter if it's a new day
  const today = new Date().toDateString();
  if (today !== tokenResetDate) {
    tokensUsedToday = 0;
    tokenResetDate = today;
  }

  const estimatedCost = (tokensUsedToday / 1_000_000) * COST_PER_MILLION_TOKENS;
  const budgetRemaining = RATE_LIMITS.dailyBudgetUSD - estimatedCost;

  return {
    allowed: budgetRemaining > 0,
    tokensUsed: tokensUsedToday,
    estimatedCost,
    budgetRemaining: Math.max(0, budgetRemaining)
  };
}

/**
 * Record token usage for budget tracking.
 */
export function recordTokenUsage(inputTokens: number, outputTokens: number): void {
  // Reset if new day
  const today = new Date().toDateString();
  if (today !== tokenResetDate) {
    tokensUsedToday = 0;
    tokenResetDate = today;
  }

  tokensUsedToday += inputTokens + outputTokens;
}

/**
 * Get rate limit info for response headers.
 */
export function getRateLimitHeaders(identifier: string): Record<string, string> {
  const minuteKey = `${identifier}:minute`;
  const minuteEntry = rateLimitStore.get(minuteKey);

  const remaining = minuteEntry
    ? Math.max(0, RATE_LIMITS.perMinute - minuteEntry.count)
    : RATE_LIMITS.perMinute;

  const resetAt = minuteEntry?.resetAt || Date.now() + 60000;

  return {
    'X-RateLimit-Limit': String(RATE_LIMITS.perMinute),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000))
  };
}

/**
 * Clean up expired rate limit entries (call periodically).
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000);
}
