import { getSchoolProfile, getCitywideStats, findSchoolsByNameOrDBN } from '@/lib/db/queries';
import type { SchoolProfile } from '@/lib/db/queries';
import type { ResponseContext } from '@/types/school';

export interface GetSchoolProfileParams {
  dbn: string;
  include_similar?: boolean;
}

export interface GetSchoolProfileResult {
  profile: SchoolProfile | null;
  suggestions?: Array<{ dbn: string; name: string; borough: string }>;
  _context: ResponseContext;
}

// Map old DB category values to new names in response
const mapCategory = (cat: string | null): string | null => {
  if (cat === 'developing') return 'below_growth_threshold';
  if (cat === 'below_threshold') return 'lower_economic_need';
  return cat;
};

/**
 * Get detailed profile for a specific school including trends across available years.
 * Now includes location, budget, suspension, and PTA data.
 * Returns suggestions if the exact DBN is not found.
 */
export function getSchoolProfileTool(params: GetSchoolProfileParams): GetSchoolProfileResult {
  const rawProfile = getSchoolProfile(params.dbn);
  const citywideStats = getCitywideStats('2024-25');

  // If profile not found, search for suggestions
  let suggestions: Array<{ dbn: string; name: string; borough: string }> | undefined;
  if (!rawProfile) {
    suggestions = findSchoolsByNameOrDBN(params.dbn, 5);
    // Only include suggestions if we found any
    if (suggestions.length === 0) {
      suggestions = undefined;
    }
  }

  // Map category names in the profile
  const profile = rawProfile ? {
    ...rawProfile,
    metrics: {
      current: rawProfile.metrics.current ? {
        ...rawProfile.metrics.current,
        category: mapCategory(rawProfile.metrics.current.category) as typeof rawProfile.metrics.current.category
      } : undefined,
      previous: rawProfile.metrics.previous ? {
        ...rawProfile.metrics.previous,
        category: mapCategory(rawProfile.metrics.previous.category) as typeof rawProfile.metrics.previous.category
      } : undefined,
    },
    similarSchools: rawProfile.similarSchools.map(s => ({
      ...s,
      category: mapCategory(s.category) as typeof s.category
    }))
  } : null;

  const limitations: string[] = [
    'Based on NYC DOE School Quality Report data',
    'Impact Score methodology not fully disclosed by DOE',
  ];

  if (profile) {
    // Add specific limitations based on data
    if (profile.metrics.current && profile.metrics.previous) {
      limitations.push(
        'Year-over-year changes may reflect cohort differences, not school improvement'
      );
    } else {
      limitations.push('Only one year of data available for this school');
    }

    if (profile.isPersistentGem) {
      limitations.push(
        'Persistent high growth status suggests consistency, but cannot determine causation'
      );
    }

    if (profile.metrics.current?.enrollment && profile.metrics.current.enrollment < 200) {
      limitations.push(
        'Small school enrollment may lead to more volatile year-over-year metrics'
      );
    }

    // Suspension-specific limitations
    if (profile.suspensions.some(s => s.is_redacted)) {
      limitations.push(
        'Some suspension values are redacted (marked "R") due to small counts for privacy protection'
      );
    }

    // Budget-specific limitations
    if (profile.budgets.length > 0 && profile.school.is_charter) {
      limitations.push(
        'Charter school budget data is not directly comparable to DOE-managed school budgets'
      );
    }
  }

  const result: GetSchoolProfileResult = {
    profile,
    _context: {
      sample_size: profile ? 1 : 0,
      data_year: '2024-25',
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72
      },
      limitations,
      methodology_note: 'Profile includes both years of data when available. Similar schools are matched by ENI (±0.05) and enrollment (±20%). Budget data from LL16 reports, suspension data from LL93 reports, PTA data from DOE financial reporting.'
    }
  };

  if (suggestions) {
    result.suggestions = suggestions;
  }

  return result;
}

export const getSchoolProfileDefinition = {
  name: 'get_school_profile',
  description: `Get detailed profile for a specific school including metrics, trends, and context.

Returns comprehensive data:
- Both years of Impact and Performance scores (2023-24 and 2024-25)
- Year-over-year change indicators
- Economic Need Index with percentile
- Enrollment and school type
- Category assignment (Strong Growth + Outcomes, High Growth, High Achievement, Developing)
- Comparison to citywide and similar-school medians
- Location data (address, grades, principal, neighborhood)
- Budget data (total budget, % funded, FSF allocation) for up to 3 years
- Suspension data (removals, principal/superintendent suspensions) for up to 3 years
- PTA financial data (income, expenses, balance) for up to 3 years
- Data limitations specific to this school

Use this when users ask about a specific school by name or DBN.`,
  parameters: {
    type: 'object',
    properties: {
      dbn: {
        type: 'string',
        description: 'District-Borough-Number (e.g., "01M188")'
      },
      include_similar: {
        type: 'boolean',
        default: true,
        description: 'Include list of similar schools for comparison'
      }
    },
    required: ['dbn']
  }
};
