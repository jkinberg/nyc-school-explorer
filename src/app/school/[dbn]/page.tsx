import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSchoolProfile } from '@/lib/db/queries';
import { MetricDisplay, MetricComparison } from '@/components/schools/MetricDisplay';
import { SchoolCard } from '@/components/schools/SchoolCard';
import { LimitationsBanner } from '@/components/common/LimitationsBanner';
import { formatCategory, formatCurrency } from '@/lib/utils/formatting';

interface PageProps {
  params: Promise<{ dbn: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { dbn } = await params;
  const profile = getSchoolProfile(dbn);

  if (!profile) {
    return { title: 'School Not Found | NYC School Explorer' };
  }

  return {
    title: `${profile.school.name} | NYC School Explorer`,
    description: `School Quality Report data for ${profile.school.name} in ${profile.school.borough}.`,
  };
}

export default async function SchoolPage({ params }: PageProps) {
  const { dbn } = await params;
  const profile = getSchoolProfile(dbn);

  if (!profile) {
    notFound();
  }

  const { school, metrics, isPersistentGem, similarSchools, citywideStats, location, budgets, suspensions, pta } = profile;
  const current = metrics.current;
  const previous = metrics.previous;

  // Category badge styling
  const categoryStyles: Record<string, string> = {
    elite: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    hidden_gem: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    anomaly: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    typical: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    low_poverty: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link href="/search" className="text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Search
        </Link>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {school.name}
          </h1>
          {current?.category && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${categoryStyles[current.category] || categoryStyles.typical}`}>
              {formatCategory(current.category)}
            </span>
          )}
          {isPersistentGem && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              Persistent Gem
            </span>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {school.borough} · {school.school_type} · DBN: {school.dbn}
          {school.is_charter && ' · Charter School'}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          2024-25 Metrics
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <MetricDisplay
            label="Impact Score"
            value={current?.impact_score ?? null}
            median={citywideStats?.median_impact_score}
            description="Student growth"
          />
          <MetricDisplay
            label="Performance Score"
            value={current?.performance_score ?? null}
            median={citywideStats?.median_performance_score}
            description="Absolute outcomes"
          />
          <MetricDisplay
            label="Economic Need Index"
            value={current?.economic_need_index ?? null}
            median={citywideStats?.median_economic_need}
            description="Poverty indicator"
          />
          <MetricDisplay
            label="Enrollment"
            value={current?.enrollment ?? null}
            format="number"
            description="Students"
            showBar={false}
          />
        </div>
      </div>

      {/* Year-over-Year Comparison */}
      {previous && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Year-over-Year Change
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Impact Score</p>
              <MetricComparison
                current={current?.impact_score ?? null}
                previous={previous?.impact_score ?? null}
                label="Impact Score"
              />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Performance Score</p>
              <MetricComparison
                current={current?.performance_score ?? null}
                previous={previous?.performance_score ?? null}
                label="Performance Score"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Note: Year-over-year changes may reflect cohort differences, not actual school improvement.
          </p>
        </div>
      )}

      {/* Additional Metrics */}
      {current && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Additional Metrics
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            {current.student_attendance && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Student Attendance:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {(current.student_attendance * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {current.teacher_attendance && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Teacher Attendance:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {(current.teacher_attendance * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {current.principal_years && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Principal Tenure:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {current.principal_years} years
                </span>
              </div>
            )}
            {current.pct_teachers_3plus_years && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Teachers 3+ Years:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {(current.pct_teachers_3plus_years * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {current.rating_instruction && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Instruction Rating:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {current.rating_instruction}
                </span>
              </div>
            )}
            {current.rating_safety && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Safety Rating:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {current.rating_safety}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location */}
      {location && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Location
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            {location.address && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Address:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {location.address}, {location.city}, {location.state} {location.zip}
                </span>
              </div>
            )}
            {location.grades_final_text && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Grades Served:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {location.grades_final_text}
                </span>
              </div>
            )}
            {location.principal_name && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Principal:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {location.principal_name}
                </span>
              </div>
            )}
            {location.phone && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Phone:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {location.phone}
                </span>
              </div>
            )}
            {location.nta && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Neighborhood:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {location.nta}
                </span>
              </div>
            )}
            {location.council_district && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Council District:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {location.council_district}
                </span>
              </div>
            )}
            {location.building_code && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Building Code:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {location.building_code}
                </span>
              </div>
            )}
            {location.managed_by && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Managed By:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">
                  {location.managed_by}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Budget */}
      {budgets.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Budget (Fair Student Funding)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4">Year</th>
                  <th className="pb-2 pr-4">Total Budget</th>
                  <th className="pb-2 pr-4">FSF Allocation</th>
                  <th className="pb-2 pr-4">% Funded</th>
                  <th className="pb-2">Gap to 100%</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.year} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{b.year}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{formatCurrency(b.total_budget_allocation)}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{formatCurrency(b.total_fsf_allocation)}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {b.pct_funded !== null ? `${(b.pct_funded * 100).toFixed(0)}%` : 'N/A'}
                    </td>
                    <td className="py-2 text-gray-900 dark:text-white">{formatCurrency(b.gap_to_100_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {school.is_charter && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Note: Charter school budget data is not directly comparable to DOE-managed school budgets.
            </p>
          )}
        </div>
      )}

      {/* Discipline */}
      {suspensions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Discipline (Suspensions)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4">Year</th>
                  <th className="pb-2 pr-4">Removals</th>
                  <th className="pb-2 pr-4">Principal Susp.</th>
                  <th className="pb-2 pr-4">Supt. Susp.</th>
                  <th className="pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {suspensions.map((s) => (
                  <tr key={s.year} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{s.year}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {s.removals !== null ? s.removals : (s.is_redacted ? 'Redacted' : 'N/A')}
                    </td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {s.principal_suspensions !== null ? s.principal_suspensions : (s.is_redacted ? 'Redacted' : 'N/A')}
                    </td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {s.superintendent_suspensions !== null ? s.superintendent_suspensions : (s.is_redacted ? 'Redacted' : 'N/A')}
                    </td>
                    <td className="py-2 text-gray-900 dark:text-white">
                      {s.total_suspensions !== null ? s.total_suspensions : (s.is_redacted ? 'Redacted' : 'N/A')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            &quot;Redacted&quot; indicates small counts (1-5) suppressed for privacy. Suspension data reflects systemic patterns as much as individual school decisions. Always consider ENI context.
          </p>
        </div>
      )}

      {/* PTA Financial */}
      {pta.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            PTA Financial Summary
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4">Year</th>
                  <th className="pb-2 pr-4">Beginning Balance</th>
                  <th className="pb-2 pr-4">Income</th>
                  <th className="pb-2 pr-4">Expenses</th>
                  <th className="pb-2">Ending Balance</th>
                </tr>
              </thead>
              <tbody>
                {pta.map((p) => (
                  <tr key={p.year} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{p.year}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{formatCurrency(p.beginning_balance)}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{formatCurrency(p.total_income)}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{formatCurrency(p.total_expenses)}</td>
                    <td className="py-2 text-gray-900 dark:text-white">{formatCurrency(p.ending_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            PTA income primarily reflects parent wealth, not school quality. Some schools have very active PTAs while others raise very little.
          </p>
        </div>
      )}

      {/* Similar Schools */}
      {similarSchools.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Similar Schools
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Schools with similar Economic Need (±5%) and enrollment (±20%)
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {similarSchools.slice(0, 4).map((s) => (
              <SchoolCard key={s.dbn} school={s} compact />
            ))}
          </div>
        </div>
      )}

      {/* Limitations */}
      <LimitationsBanner />

      {/* Explore more */}
      <div className="mt-8 text-center">
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
        >
          Ask questions about this school with AI
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
