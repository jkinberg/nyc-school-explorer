/**
 * Levenshtein distance calculation for fuzzy string matching.
 * Used as fallback when LIKE queries return no results.
 */

/**
 * Calculate the Levenshtein edit distance between two strings.
 * Uses Wagner-Fischer algorithm with O(min(m,n)) space complexity.
 */
export function levenshteinDistance(a: string, b: string): number {
  // Normalize: lowercase and trim
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  // Early exit for identical strings
  if (s1 === s2) return 0;

  // Ensure s1 is the shorter string for space efficiency
  const [shorter, longer] = s1.length <= s2.length ? [s1, s2] : [s2, s1];

  // Use single row optimization
  const row = Array.from({ length: shorter.length + 1 }, (_, i) => i);

  for (let i = 1; i <= longer.length; i++) {
    let prev = i;
    for (let j = 1; j <= shorter.length; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      const current = Math.min(
        row[j] + 1,      // deletion
        prev + 1,        // insertion
        row[j - 1] + cost // substitution
      );
      row[j - 1] = prev;
      prev = current;
    }
    row[shorter.length] = prev;
  }

  return row[shorter.length];
}

/**
 * Find fuzzy matches from a list of candidates.
 * Returns candidates sorted by edit distance (ascending).
 *
 * For school name matching, compares against individual words in the name
 * to handle cases like "Stuyvesent" matching "Stuyvesant High School".
 */
export function findFuzzyMatches<T>(
  query: string,
  candidates: T[],
  getText: (item: T) => string,
  maxDistance: number = 3,
  limit: number = 5
): Array<{ item: T; distance: number }> {
  const results: Array<{ item: T; distance: number }> = [];
  const queryLower = query.toLowerCase().trim();

  for (const candidate of candidates) {
    const text = getText(candidate);

    // First check full text match
    let distance = levenshteinDistance(query, text);

    // If full text doesn't match, check individual words
    // This handles "Stuyvesent" matching "Stuyvesant High School"
    if (distance > maxDistance) {
      const words = text.split(/\s+/);
      for (const word of words) {
        // Skip very short words (articles, etc.)
        if (word.length < 3) continue;
        const wordDistance = levenshteinDistance(query, word);
        if (wordDistance < distance) {
          distance = wordDistance;
        }
      }
    }

    if (distance <= maxDistance) {
      results.push({ item: candidate, distance });
    }
  }

  // Sort by distance (closest first), then limit
  return results
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
