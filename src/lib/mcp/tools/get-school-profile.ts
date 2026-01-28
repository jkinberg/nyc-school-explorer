import { getSchoolProfile, getCitywideStats } from '@/lib/db/queries';
import type { SchoolProfile } from '@/lib/db/queries';
import type { ResponseContext } from '@/types/school';

export interface GetSchoolProfileParams {
  dbn: string;
  include_similar?: boolean;
}

export interface GetSchoolProfileResult {
  profile: SchoolProfile | null;
  _context: ResponseContext;
}

/**
 * Get detailed profile for a specific school including trends across available years.
 * Now includes location, budget, suspension, and PTA data.
 */
export function getSchoolProfileTool(params: GetSchoolProfileParams): GetSchoolProfileResult {
  const profile = getSchoolProfile(params.dbn);
  const citywideStats = getCitywideStats('2024-25');

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
        'Persistent gem status suggests consistency, but cannot determine causation'
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

  return {
    profile,
    _context: {
      sample_size: 1,
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
}

export const getSchoolProfileDefinition = {
  name: 'get_school_profile',
  description: `Get detailed profile for a specific school including metrics, trends, and context.

Returns comprehensive data:
- Both years of Impact and Performance scores (2023-24 and 2024-25)
- Year-over-year change indicators
- Economic Need Index with percentile
- Enrollment and school type
- Category assignment (Elite, Hidden Gem, Anomaly, Typical)
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
