import { NextRequest, NextResponse } from 'next/server';
import { getSchoolProfile } from '@/lib/db/queries';

/**
 * GET /api/schools/[dbn]
 *
 * Get detailed profile for a specific school.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dbn: string }> }
) {
  try {
    const { dbn } = await params;

    if (!dbn) {
      return NextResponse.json(
        { error: 'DBN is required' },
        { status: 400 }
      );
    }

    const profile = getSchoolProfile(dbn);

    if (!profile) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      profile,
      _context: {
        data_year: '2024-25',
        citywide_medians: profile.citywideStats
          ? {
              impact: profile.citywideStats.median_impact_score,
              performance: profile.citywideStats.median_performance_score,
              eni: profile.citywideStats.median_economic_need
            }
          : { impact: 0.50, performance: 0.50, eni: 0.72 },
        available_data: {
          location: !!profile.location,
          budgets: profile.budgets.length,
          suspensions: profile.suspensions.length,
          pta: profile.pta.length,
        }
      }
    });

  } catch (error) {
    console.error('School profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch school profile' },
      { status: 500 }
    );
  }
}
