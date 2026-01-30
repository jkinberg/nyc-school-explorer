import { NextRequest, NextResponse } from 'next/server';
import { getSchoolsByCategory, getPersistentGems, getCitywideStats } from '@/lib/db/queries';
import type { CuratedListType } from '@/types/school';

const LIST_DESCRIPTIONS: Record<string, string> = {
  high_growth: "Elementary/Middle Schools with strong student growth (Impact ≥ 0.55) despite lower absolute scores (Performance < 0.50), serving high-poverty populations.",
  persistent_high_growth: "Elementary/Middle Schools that maintained high-impact status across both 2023-24 and 2024-25.",
  high_growth_high_achievement: "Elementary/Middle Schools achieving both strong growth AND strong absolute outcomes while serving high-poverty populations.",
  high_achievement: "Elementary/Middle Schools with strong absolute scores but moderate growth - students may arrive well-prepared."
};

/**
 * GET /api/schools/gems
 *
 * Get curated lists of schools by category.
 * Defaults to EMS (Elementary/Middle Schools) - the scope of the original high growth analysis.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const listType = (searchParams.get('type') || 'high_growth') as CuratedListType;
    const borough = searchParams.get('borough') || undefined;
    const reportType = searchParams.get('report_type') || 'EMS'; // Default to EMS
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    // Determine effective report type for queries
    const effectiveReportType = reportType === 'all' ? 'all' : reportType;

    let schools;

    // Get the appropriate list with report_type filter
    if (listType === 'persistent_high_growth') {
      schools = getPersistentGems(effectiveReportType);
    } else {
      schools = getSchoolsByCategory(listType, '2024-25', 200, effectiveReportType);
    }

    // Apply borough filter if provided
    if (borough) {
      schools = schools.filter(s => s.borough === borough);
    }

    // Apply limit
    schools = schools.slice(0, limit);

    const citywideStats = getCitywideStats('2024-25');

    // Build scope description
    const scopeLabel = reportType === 'all'
      ? 'All School Types'
      : reportType === 'EMS'
        ? 'Elementary/Middle Schools'
        : `${reportType} Schools`;

    // Add scope caveat for non-EMS queries
    const scopeNote = reportType !== 'EMS'
      ? `Note: The four-group framework was validated for Elementary/Middle Schools only. Results for ${scopeLabel} may show different patterns.`
      : undefined;

    return NextResponse.json({
      list_type: listType,
      description: LIST_DESCRIPTIONS[listType] || '',
      count: schools.length,
      schools,
      scope: scopeLabel,
      _context: {
        data_year: '2024-25',
        scope: scopeLabel,
        scope_note: scopeNote,
        citywide_medians: {
          impact: citywideStats?.median_impact_score || 0.50,
          performance: citywideStats?.median_performance_score || 0.50,
          eni: citywideStats?.median_economic_need || 0.72
        },
        criteria: {
          high_impact: '>= 0.55',
          high_performance: '>= 0.50',
          high_poverty: 'ENI >= 0.85'
        }
      }
    });

  } catch (error) {
    console.error('Gems API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch curated list' },
      { status: 500 }
    );
  }
}
