'use client';

import { useState } from 'react';

interface LimitationsBannerProps {
  compact?: boolean;
}

const LIMITATIONS = [
  'Only 2 years of Impact Score data available (2023-24, 2024-25)',
  'Impact Score methodology not fully disclosed by NYC DOE',
  'Cannot determine causation - only patterns and correlations',
  'No student mobility data (selection effects cannot be ruled out)',
  'Many schools change category year-over-year',
];

export function LimitationsBanner({ compact }: LimitationsBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (compact) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This data shows patterns, not proof of causation.{' '}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="underline hover:no-underline"
            >
              {isExpanded ? 'Show less' : 'Learn more'}
            </button>
          </p>
        </div>
        {isExpanded && (
          <ul className="mt-2 ml-7 text-sm text-amber-700 dark:text-amber-300 space-y-1">
            {LIMITATIONS.map((limitation, i) => (
              <li key={i} className="list-disc">{limitation}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div>
          <h3 className="text-base font-semibold text-amber-800 dark:text-amber-200">
            Data Limitations
          </h3>
          <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
            {LIMITATIONS.map((limitation, i) => (
              <li key={i} className="list-disc ml-4">{limitation}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
