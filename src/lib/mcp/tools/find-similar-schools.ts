import { findSimilarSchools, getLatestMetrics, getSchoolByDBN, getCitywideStats } from '@/lib/db/queries';
import type { SchoolWithMetrics, ResponseContext } from '@/types/school';

export interface FindSimilarSchoolsParams {
  dbn: string;
  match_criteria?: ('economic_need' | 'enrollment' | 'borough' | 'report_type')[];
  eni_tolerance?: number;
  enrollment_tolerance?: number;
  limit?: number;
}

export interface FindSimilarSchoolsResult {
  reference_school: {
    dbn: string;
    name: string;
    impact_score: number | null;
    performance_score: number | null;
    economic_need_index: number | null;
    enrollment: number | null;
  } | null;
  similar_schools: SchoolWithMetrics[];
  matching_criteria: string[];
  _context: ResponseContext;
}

/**
 * Find schools with similar characteristics for contextual comparison.
 */
export function findSimilarSchoolsTool(params: FindSimilarSchoolsParams): FindSimilarSchoolsResult {
  const {
    dbn,
    match_criteria = ['economic_need', 'enrollment'],
    eni_tolerance = 0.05,
    enrollment_tolerance = 0.2,
    limit = 5
  } = params;

  // Get reference school data
  const refSchool = getSchoolByDBN(dbn);
  const refMetrics = getLatestMetrics(dbn);
  const citywideStats = getCitywideStats('2024-25');

  if (!refSchool || !refMetrics) {
    return {
      reference_school: null,
      similar_schools: [],
      matching_criteria: [],
      _context: {
        sample_size: 0,
        data_year: '2024-25',
        citywide_medians: {
          impact: citywideStats?.median_impact_score || 0.50,
          performance: citywideStats?.median_performance_score || 0.50,
          eni: citywideStats?.median_economic_need || 0.72
        },
        limitations: ['School not found in database']
      }
    };
  }

  // Find similar schools
  const similarSchools = findSimilarSchools({
    dbn,
    eniTolerance: match_criteria.includes('economic_need') ? eni_tolerance : undefined,
    enrollmentTolerance: match_criteria.includes('enrollment') ? enrollment_tolerance : undefined,
    sameBorough: match_criteria.includes('borough'),
    sameReportType: match_criteria.includes('report_type'),
    limit
  });

  const limitations: string[] = [
    'Similar schools matched by quantitative characteristics only',
    'Does not account for differences in programs, leadership, or culture',
    'ENI tolerance ±' + eni_tolerance + ', enrollment tolerance ±' + (enrollment_tolerance * 100) + '%'
  ];

  if (similarSchools.length < 3) {
    limitations.push(
      'Few schools match these criteria; comparisons may be limited'
    );
  }

  return {
    reference_school: {
      dbn: refSchool.dbn,
      name: refSchool.name,
      impact_score: refMetrics.impact_score,
      performance_score: refMetrics.performance_score,
      economic_need_index: refMetrics.economic_need_index,
      enrollment: refMetrics.enrollment
    },
    similar_schools: similarSchools,
    matching_criteria: match_criteria,
    _context: {
      sample_size: similarSchools.length + 1,
      data_year: '2024-25',
      citywide_medians: {
        impact: citywideStats?.median_impact_score || 0.50,
        performance: citywideStats?.median_performance_score || 0.50,
        eni: citywideStats?.median_economic_need || 0.72
      },
      limitations,
      methodology_note: 'Similar schools are identified by matching on specified criteria. Comparing schools with similar ENI provides fairer context than raw rankings.'
    }
  };
}

export const findSimilarSchoolsDefinition = {
  name: 'find_similar_schools',
  description: `Find schools with similar characteristics for contextual comparison.

Useful for:
- Educators seeking peer schools to learn from
- Researchers comparing similar populations
- Contextualizing a school's outcomes

Matching criteria can include:
- Similar Economic Need (±0.05 by default)
- Similar enrollment size (±20% by default)
- Same borough
- Same grade configuration (report type)

Always returns context about why schools were matched and how they compare on outcomes.`,
  parameters: {
    type: 'object',
    properties: {
      dbn: {
        type: 'string',
        description: 'DBN of the reference school'
      },
      match_criteria: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['economic_need', 'enrollment', 'borough', 'report_type']
        },
        default: ['economic_need', 'enrollment'],
        description: 'Which characteristics to match on'
      },
      eni_tolerance: {
        type: 'number',
        default: 0.05,
        description: 'Tolerance for ENI matching (±this value)'
      },
      enrollment_tolerance: {
        type: 'number',
        default: 0.2,
        description: 'Tolerance for enrollment matching (±this percentage)'
      },
      limit: {
        type: 'number',
        default: 5,
        description: 'Maximum number of similar schools to return'
      }
    },
    required: ['dbn']
  }
};
