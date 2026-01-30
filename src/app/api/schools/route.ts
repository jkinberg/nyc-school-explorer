import { NextRequest, NextResponse } from 'next/server';
import { searchSchools, countSchools, getCitywideStats } from '@/lib/db/queries';

/**
 * GET /api/schools
 *
 * Search and list schools with optional filters.
 * Returns schools with full context including ENI, both scores, and citywide medians.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params = {
      query: searchParams.get('q') || undefined,
      borough: searchParams.get('borough') || undefined,
      reportType: searchParams.get('report_type') || undefined,
      minImpactScore: searchParams.get('min_impact')
        ? parseFloat(searchParams.get('min_impact')!)
        : undefined,
      maxImpactScore: searchParams.get('max_impact')
        ? parseFloat(searchParams.get('max_impact')!)
        : undefined,
      minPerformanceScore: searchParams.get('min_performance')
        ? parseFloat(searchParams.get('min_performance')!)
        : undefined,
      maxPerformanceScore: searchParams.get('max_performance')
        ? parseFloat(searchParams.get('max_performance')!)
        : undefined,
      minEni: searchParams.get('min_eni')
        ? parseFloat(searchParams.get('min_eni')!)
        : undefined,
      maxEni: searchParams.get('max_eni')
        ? parseFloat(searchParams.get('max_eni')!)
        : undefined,
      category: searchParams.get('category') || undefined,
      isCharter: searchParams.get('is_charter')
        ? searchParams.get('is_charter') === 'true'
        : undefined,
      year: searchParams.get('year') || '2024-25',
      limit: Math.min(parseInt(searchParams.get('limit') || '25'), 100),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    // Note: pct_funded and council_district filters are available through the
    // MCP search tool but not yet implemented as SQL-level joins in the
    // searchSchools query function for the REST API.

    // Get schools
    const schools = searchSchools(params);
    const totalCount = countSchools(params);
    const citywideStats = getCitywideStats(params.year);

    return NextResponse.json({
      schools,
      pagination: {
        total: totalCount,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + schools.length < totalCount
      },
      _context: {
        data_year: params.year,
        citywide_medians: {
          impact: citywideStats?.median_impact_score || 0.50,
          performance: citywideStats?.median_performance_score || 0.50,
          eni: citywideStats?.median_economic_need || 0.72
        },
        sample_size: schools.length
      }
    });

  } catch (error) {
    console.error('Schools API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schools' },
      { status: 500 }
    );
  }
}
