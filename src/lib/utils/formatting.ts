/**
 * Formatting utilities for the NYC School Data Explorer.
 */

/**
 * Format a score as a percentage string.
 */
export function formatScore(score: number | null): string {
  if (score === null || score === undefined) return 'N/A';
  return `${(score * 100).toFixed(0)}%`;
}

/**
 * Format a score with comparison to median.
 */
export function formatScoreWithContext(score: number | null, median: number): string {
  if (score === null || score === undefined) return 'N/A';

  const formatted = formatScore(score);
  const diff = score - median;

  if (Math.abs(diff) < 0.05) {
    return `${formatted} (near median)`;
  } else if (diff > 0) {
    return `${formatted} (above median)`;
  } else {
    return `${formatted} (below median)`;
  }
}

/**
 * Format Economic Need Index with percentile context.
 */
export function formatENI(eni: number | null): string {
  if (eni === null || eni === undefined) return 'N/A';

  const pct = (eni * 100).toFixed(0);
  let context: string;

  if (eni >= 0.95) context = 'very high poverty';
  else if (eni >= 0.85) context = 'high poverty';
  else if (eni >= 0.70) context = 'moderate poverty';
  else if (eni >= 0.50) context = 'lower poverty';
  else context = 'low poverty';

  return `${pct}th percentile (${context})`;
}

/**
 * Format enrollment number.
 */
export function formatEnrollment(enrollment: number | null): string {
  if (enrollment === null || enrollment === undefined) return 'N/A';
  return enrollment.toLocaleString() + ' students';
}

/**
 * Format borough name.
 */
export function formatBorough(borough: string): string {
  return borough;
}

/**
 * Format school category for display.
 */
export function formatCategory(category: string | null): string {
  if (!category) return 'Unknown';

  const labels: Record<string, string> = {
    high_growth_high_achievement: 'Strong Growth + Strong Outcomes',
    high_growth: 'Strong Growth, Building Outcomes',
    high_achievement: 'Strong Outcomes, Moderate Growth',
    developing: 'Developing on Both Metrics',
    below_threshold: 'Lower Economic Need'
  };

  return labels[category] || category;
}

/**
 * Format a correlation coefficient for display.
 */
export function formatCorrelation(r: number | null): string {
  if (r === null || r === undefined) return 'N/A';

  const absR = Math.abs(r);
  let strength: string;

  if (absR >= 0.7) strength = 'strong';
  else if (absR >= 0.5) strength = 'moderate';
  else if (absR >= 0.3) strength = 'weak';
  else strength = 'very weak';

  const direction = r >= 0 ? 'positive' : 'negative';

  return `r = ${r.toFixed(2)} (${strength} ${direction})`;
}

/**
 * Format year-over-year change.
 */
export function formatChange(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return 'N/A';

  const change = current - previous;
  const pctChange = (change * 100).toFixed(0);

  if (change > 0.05) return `↑ +${pctChange} points`;
  if (change < -0.05) return `↓ ${pctChange} points`;
  return `→ stable`;
}

/**
 * Generate a unique ID for messages.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format a school name for display (handle long names).
 */
export function formatSchoolName(name: string, maxLength = 50): string {
  return truncate(name, maxLength);
}

/**
 * Format a number as currency.
 */
export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format a date for display.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
