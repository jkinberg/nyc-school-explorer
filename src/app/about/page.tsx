import Link from 'next/link';

export const metadata = {
  title: 'About | NYC School Explorer',
  description: 'Methodology, data sources, and limitations of the NYC School Explorer.',
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        About NYC School Explorer
      </h1>

      {/* Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          What This Tool Does
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          NYC School Explorer is an AI-powered tool for exploring NYC School Quality Report data.
          It helps journalists, researchers, and educators understand patterns in school performance
          with appropriate context and limitations.
        </p>
        <p className="text-gray-700 dark:text-gray-300">
          Unlike simple ranking sites, this tool emphasizes <strong>student growth</strong> (Impact Score)
          over absolute test scores (Performance Score), and always presents metrics alongside
          poverty context (Economic Need Index).
        </p>
      </section>

      {/* Data Sources */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Data Sources
        </h2>
        <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300 space-y-3">
          <li>
            <strong>NYC DOE School Quality Reports</strong> (2022-23, 2023-24, 2024-25)
            <br />
            <span className="text-sm text-gray-500">
              Elementary/Middle (EMS), High School (HS), Transfer (HST), Early Childhood (EC), D75.
              Impact Score and Performance Score available for 2023-24 and 2024-25 only.
              ENI, survey results, attendance, and ratings available for all three years.
            </span>
          </li>
          <li>
            <strong>School Budgets (Local Law 16)</strong> (2022-23, 2023-24, 2024-25)
            <br />
            <span className="text-sm text-gray-500">
              Fair Student Funding allocations, total budget, % funded, and gap to full funding.
              Note: Charter school budgets are not directly comparable to DOE-managed schools.
            </span>
          </li>
          <li>
            <strong>Student Discipline (Local Law 93)</strong> (2022-23, 2023-24, 2024-25)
            <br />
            <span className="text-sm text-gray-500">
              Removals, principal suspensions, and superintendent suspensions by school.
              Small counts (1-5) are redacted for student privacy.
            </span>
          </li>
          <li>
            <strong>PTA Financial Reporting</strong> (2022-23, 2023-24, 2024-25)
            <br />
            <span className="text-sm text-gray-500">
              Income, expenses, and ending balances by school.
              PTA income reflects parent wealth, not school quality.
            </span>
          </li>
          <li>
            <strong>School Locations (LCGMS)</strong>
            <br />
            <span className="text-sm text-gray-500">
              Addresses, coordinates, building codes, neighborhood (NTA), council district, and principal information.
            </span>
          </li>
        </ul>
      </section>

      {/* Key Metrics */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Key Metrics Explained
        </h2>

        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              Impact Score (Student Growth)
            </h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
              Measures how much students learn relative to similar students citywide.
              A score of 0.60 means students grew more than 60% of similar students.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              <strong>Correlation with poverty:</strong> r = -0.29 (weaker than Performance Score)
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">
              Performance Score (Absolute Outcomes)
            </h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
              Measures absolute test scores and outcomes. Reflects where students are,
              not how much they grew.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              <strong>Correlation with poverty:</strong> r = -0.69 (strong negative correlation)
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-2">
              Economic Need Index (ENI)
            </h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
              Poverty indicator based on temp housing status, HRA eligibility, and free lunch data.
              Higher values indicate higher poverty.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              <strong>Citywide median:</strong> 0.87 for 2024-25 (varies by school type and year)
            </p>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          School Categories
        </h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note on Thresholds:</strong> Categories are computed for all school types using the same
            thresholds (Impact ≥ 0.55, Performance ≥ 0.50). These thresholds were validated using Elementary/Middle
            School (EMS) data, where they represent approximately the 75th percentile. The same percentile cutoffs
            may differ for High Schools and other school types.
          </p>
        </div>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          High-poverty schools (ENI ≥ 0.85) are classified based on their Impact and Performance scores:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 pr-4 text-gray-900 dark:text-white">Category</th>
                <th className="text-left py-2 pr-4 text-gray-900 dark:text-white">Impact</th>
                <th className="text-left py-2 pr-4 text-gray-900 dark:text-white">Performance</th>
                <th className="text-left py-2 text-gray-900 dark:text-white">Meaning</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium text-green-700 dark:text-green-400">Strong Growth + Strong Outcomes</td>
                <td className="py-2 pr-4">≥ 0.55</td>
                <td className="py-2 pr-4">≥ 0.50</td>
                <td className="py-2">Strong growth AND strong absolute scores</td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium text-amber-700 dark:text-amber-400">Strong Growth, Building Outcomes</td>
                <td className="py-2 pr-4">≥ 0.55</td>
                <td className="py-2 pr-4">&lt; 0.50</td>
                <td className="py-2">Strong growth despite lower absolute scores</td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium text-purple-700 dark:text-purple-400">Strong Outcomes, Moderate Growth</td>
                <td className="py-2 pr-4">&lt; 0.55</td>
                <td className="py-2 pr-4">≥ 0.50</td>
                <td className="py-2">Strong scores but moderate growth (rare)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-gray-700 dark:text-gray-400">Developing on Both Metrics</td>
                <td className="py-2 pr-4">&lt; 0.55</td>
                <td className="py-2 pr-4">&lt; 0.50</td>
                <td className="py-2">Neither strong growth nor strong scores</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Schools with ENI below 0.85 are classified as &quot;Lower Economic Need&quot; and excluded from this framework.
        </p>

        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
            Persistent High Growth
          </h3>
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            Schools that maintained &quot;Strong Growth&quot; status (Impact ≥ 0.55) across both 2023-24 and 2024-25.
            Two consecutive years of high growth suggests more consistent patterns, though we still cannot
            determine why these schools produce strong results.
          </p>
        </div>
      </section>

      {/* Why EMS Focus */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Why the High Growth Page Focuses on EMS
        </h2>
        <div className="text-gray-700 dark:text-gray-300 space-y-4">
          <p>
            While categories are computed for all school types, the{' '}
            <Link href="/high-growth" className="text-blue-600 dark:text-blue-400 hover:underline">High Growth Schools</Link>{' '}
            page defaults to Elementary/Middle Schools (EMS). This focus exists for several reasons:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Threshold validation:</strong> The thresholds (Impact ≥ 0.55, Performance ≥ 0.50)
              were calibrated using EMS data where they represent approximately the 75th percentile.
              The same thresholds may represent different percentiles for High Schools.
            </li>
            <li>
              <strong>Different metrics:</strong> High School reports include graduation rates
              and other metrics not present in EMS reports, which may affect how Impact Score
              is calculated.
            </li>
            <li>
              <strong>Sample size:</strong> EMS represents the largest group of schools,
              providing more robust patterns.
            </li>
            <li>
              <strong>Methodological consistency:</strong> Focusing on one school type ensures
              findings are internally consistent and comparable.
            </li>
          </ul>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            You can explore High Schools and other school types through the search and chat features.
            Categories are available for all school types, but interpret with caution since the
            thresholds were not specifically validated for non-EMS schools.
          </p>
        </div>
      </section>

      {/* Limitations */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Important Limitations
        </h2>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6">
          <ul className="space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex gap-2">
              <span className="text-red-600 dark:text-red-400">•</span>
              <span>
                <strong>Only 2 years of data:</strong> Impact Score data is available for 2023-24 and 2024-25 only.
                This limits our ability to identify long-term patterns.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600 dark:text-red-400">•</span>
              <span>
                <strong>Methodology not fully disclosed:</strong> The NYC DOE has not published the complete
                methodology for calculating Impact Score.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600 dark:text-red-400">•</span>
              <span>
                <strong>Cannot prove causation:</strong> Correlations and patterns do not prove what causes
                high or low performance. Multiple explanations exist for every finding.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600 dark:text-red-400">•</span>
              <span>
                <strong>No student mobility data:</strong> We cannot rule out selection effects
                (students leaving or being counseled out).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600 dark:text-red-400">•</span>
              <span>
                <strong>Year-over-year volatility:</strong> Many schools change category between years.
                A single year's data may not reflect long-term patterns.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Responsible AI */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Responsible AI Design
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          This tool includes multiple guardrails to prevent harmful use:
        </p>
        <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300 space-y-2">
          <li>Refuses to rank schools &quot;best to worst&quot;</li>
          <li>Does not filter by demographic percentages</li>
          <li>Always includes poverty context (ENI) with performance metrics</li>
          <li>Presents multiple hypotheses for patterns, not single explanations</li>
          <li>Uses &quot;schools facing challenges&quot; not &quot;failing schools&quot;</li>
          <li>Acknowledges limitations in every response</li>
        </ul>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Feedback & Questions
        </h2>
        <p className="text-gray-700 dark:text-gray-300">
          This is a portfolio project demonstrating AI-native data journalism.
          For questions about methodology or to report issues, please open an issue
          on the project repository.
        </p>
      </section>

      {/* CTA */}
      <div className="mt-12 text-center">
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start Exploring
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
