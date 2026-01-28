import { getSchoolsByCategory, getPersistentGems, getCitywideStats } from '@/lib/db/queries';
import { SchoolCard } from '@/components/schools/SchoolCard';
import { LimitationsBanner } from '@/components/common/LimitationsBanner';
import Link from 'next/link';

export const metadata = {
  title: 'Hidden Gems | NYC School Explorer',
  description: 'Elementary/Middle Schools producing exceptional student growth despite high poverty levels.',
};

export default async function GemsPage() {
  // Fetch data server-side - scoped to EMS (Elementary/Middle Schools)
  const persistentGems = getPersistentGems('EMS');
  const allGems = getSchoolsByCategory('hidden_gem', '2024-25', 100, 'EMS');
  const eliteSchools = getSchoolsByCategory('elite', '2024-25', 50, 'EMS');
  const citywideStats = getCitywideStats('2024-25');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Hidden Gems
          </h1>
          <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
            Elementary/Middle Schools
          </span>
        </div>
        <p className="text-gray-600 dark:text-gray-400 max-w-3xl">
          Elementary/Middle Schools producing exceptional student growth (Impact Score ≥ 0.60) despite high poverty
          (ENI ≥ 0.85) and lower absolute test scores (Performance Score &lt; 0.50).
          These schools may be doing something right that traditional metrics miss.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Note: This analysis applies to Elementary/Middle Schools only. High Schools and other school types
          show different patterns and require separate analysis.
        </p>
      </div>

      {/* Limitations Banner */}
      <div className="mb-8">
        <LimitationsBanner />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {persistentGems.length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Persistent Gems
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            High-impact both years
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {allGems.length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Hidden Gems (2024-25)
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            High growth, lower scores
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {eliteSchools.length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Elite Schools
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            High growth + high scores
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {citywideStats?.total_schools || 0}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total Schools
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Citywide with data
          </p>
        </div>
      </div>

      {/* Persistent Gems Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Persistent Hidden Gems
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Schools that maintained high-impact status in both 2023-24 and 2024-25.
              Two years of consistency suggests something real.
            </p>
          </div>
        </div>

        {persistentGems.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {persistentGems.slice(0, 12).map((school) => (
              <SchoolCard key={school.dbn} school={school} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 py-8 text-center">
            No persistent gems found.
          </p>
        )}

        {persistentGems.length > 12 && (
          <div className="mt-4 text-center">
            <Link
              href="/search?category=persistent_gems"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all {persistentGems.length} persistent gems →
            </Link>
          </div>
        )}
      </section>

      {/* All Hidden Gems Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              All Hidden Gems (2024-25)
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              High-growth schools that may not have maintained status across years.
            </p>
          </div>
        </div>

        {allGems.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allGems.slice(0, 9).map((school) => (
              <SchoolCard key={school.dbn} school={school} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 py-8 text-center">
            No hidden gems found for this year.
          </p>
        )}

        {allGems.length > 9 && (
          <div className="mt-4 text-center">
            <Link
              href="/search?category=hidden_gem"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all {allGems.length} hidden gems →
            </Link>
          </div>
        )}
      </section>

      {/* Elite Schools Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Elite Schools
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              High poverty schools achieving both high growth AND high absolute scores.
              The dual success story.
            </p>
          </div>
        </div>

        {eliteSchools.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eliteSchools.slice(0, 6).map((school) => (
              <SchoolCard key={school.dbn} school={school} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 py-8 text-center">
            No elite schools found.
          </p>
        )}

        {eliteSchools.length > 6 && (
          <div className="mt-4 text-center">
            <Link
              href="/search?category=elite"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all {eliteSchools.length} elite schools →
            </Link>
          </div>
        )}
      </section>

      {/* Methodology Note */}
      <div className="mt-12 bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          How Categories Are Computed
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-3">
          Scope: Elementary/Middle Schools (EMS) Only
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• <strong>High Impact</strong>: Impact Score ≥ 0.60 (top ~quartile)</li>
          <li>• <strong>High Performance</strong>: Performance Score ≥ 0.50 (above median)</li>
          <li>• <strong>High Poverty</strong>: Economic Need Index ≥ 0.85</li>
          <li>• <strong>Hidden Gem</strong>: High Impact + NOT High Performance + High Poverty</li>
          <li>• <strong>Elite</strong>: High Impact + High Performance + High Poverty</li>
          <li>• <strong>Persistent</strong>: Category maintained in both 2023-24 and 2024-25</li>
        </ul>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-3">
          These thresholds were validated for Elementary/Middle Schools. High Schools and other
          school types have different score distributions and may require different thresholds.
        </p>
        <Link
          href="/about"
          className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          Learn more about the methodology →
        </Link>
      </div>
    </div>
  );
}
