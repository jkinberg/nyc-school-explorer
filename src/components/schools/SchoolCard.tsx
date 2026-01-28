'use client';

import Link from 'next/link';
import { formatScore, formatENI, formatEnrollment } from '@/lib/utils/formatting';

interface SchoolCardProps {
  school: {
    dbn: string;
    name: string;
    borough: string;
    school_type?: string;
    impact_score: number | null;
    performance_score: number | null;
    economic_need_index: number | null;
    enrollment: number | null;
    category: string | null;
  };
  showCategory?: boolean;
  compact?: boolean;
}

const CATEGORY_BADGES: Record<string, { label: string; color: string }> = {
  elite: { label: 'Elite', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  hidden_gem: { label: 'Hidden Gem', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  anomaly: { label: 'Anomaly', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  typical: { label: 'Typical', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
};

export function SchoolCard({ school, showCategory = true, compact }: SchoolCardProps) {
  const categoryBadge = school.category && CATEGORY_BADGES[school.category];

  if (compact) {
    return (
      <Link
        href={`/school/${school.dbn}`}
        className="block p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {school.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {school.borough}
            </p>
          </div>
          {showCategory && categoryBadge && (
            <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${categoryBadge.color}`}>
              {categoryBadge.label}
            </span>
          )}
        </div>
        <div className="mt-2 flex gap-4 text-sm">
          <span className="text-gray-600 dark:text-gray-300">
            Impact: <strong>{formatScore(school.impact_score)}</strong>
          </span>
          <span className="text-gray-600 dark:text-gray-300">
            ENI: <strong>{school.economic_need_index ? (school.economic_need_index * 100).toFixed(0) + '%' : 'N/A'}</strong>
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/school/${school.dbn}`}
      className="block p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {school.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {school.borough} · {school.school_type || 'School'} · {school.dbn}
          </p>
        </div>
        {showCategory && categoryBadge && (
          <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${categoryBadge.color}`}>
            {categoryBadge.label}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Impact Score
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatScore(school.impact_score)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Student growth
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Performance Score
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatScore(school.performance_score)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Absolute outcomes
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Economic Need
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {school.economic_need_index ? (school.economic_need_index * 100).toFixed(0) + '%' : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Poverty indicator
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Enrollment
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {school.enrollment?.toLocaleString() || 'N/A'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Students
          </p>
        </div>
      </div>
    </Link>
  );
}
