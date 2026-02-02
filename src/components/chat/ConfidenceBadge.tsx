'use client';

import { useState } from 'react';
import type { EvaluationResult } from '@/types/chat';

type ConfidenceLevel = 'high' | 'verified' | 'review_suggested' | 'low';

interface ConfidenceBadgeProps {
  evaluation: EvaluationResult;
}

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { label: string; color: string; bgColor: string }> = {
  high: {
    label: 'High confidence',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30'
  },
  verified: {
    label: 'Verified',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30'
  },
  review_suggested: {
    label: 'Review suggested',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
  },
  low: {
    label: 'Low confidence',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30'
  }
};

const SCORE_BAR_COLORS: Record<ConfidenceLevel, string> = {
  high: 'bg-green-500 dark:bg-green-400',
  verified: 'bg-blue-500 dark:bg-blue-400',
  review_suggested: 'bg-yellow-500 dark:bg-yellow-400',
  low: 'bg-red-500 dark:bg-red-400',
};

const DIMENSION_LABELS: Record<string, { label: string; weight: number }> = {
  factual_accuracy: { label: 'Factual Accuracy', weight: 25 },
  context_inclusion: { label: 'Context Inclusion', weight: 20 },
  limitation_acknowledgment: { label: 'Limitation Acknowledgment', weight: 20 },
  responsible_framing: { label: 'Responsible Framing', weight: 20 },
  query_relevance: { label: 'Query Relevance', weight: 15 },
};

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 90) return 'high';
  if (score >= 75) return 'verified';
  if (score >= 60) return 'review_suggested';
  return 'low';
}

function LevelIcon({ level }: { level: ConfidenceLevel }) {
  if (level === 'high') {
    return (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (level === 'verified') {
    return (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (level === 'review_suggested') {
    return (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }
  // low
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  );
}

function ScoreBar({ score, level }: { score: number; level: ConfidenceLevel }) {
  const barColor = SCORE_BAR_COLORS[level];
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`h-2 w-4 rounded-sm ${
            i <= score ? barColor : 'bg-gray-200 dark:bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

export function ConfidenceBadge({ evaluation }: ConfidenceBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const level = getConfidenceLevel(evaluation.weighted_score);
  const config = CONFIDENCE_CONFIG[level];

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${config.label}: score ${evaluation.weighted_score} out of 100. Click to ${expanded ? 'collapse' : 'expand'} details.`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} hover:opacity-80 transition-opacity cursor-pointer`}
        >
          <LevelIcon level={level} />
          {config.label}
          <span className="opacity-75">({evaluation.weighted_score}/100)</span>
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        {evaluation.auto_logged && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Logged for review
          </span>
        )}
      </div>

      {expanded && (
        <div className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm">
          {/* Summary */}
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            {evaluation.summary}
          </p>

          {/* Dimension scores */}
          <div className="space-y-2 mb-3">
            {Object.entries(DIMENSION_LABELS).map(([key, { label, weight }]) => {
              const score = evaluation.scores[key as keyof typeof evaluation.scores];
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-44 shrink-0">
                    {label} <span className="opacity-60">({weight}%)</span>
                  </span>
                  <ScoreBar score={score} level={level} />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-6 text-right">{score}/5</span>
                </div>
              );
            })}
          </div>

          {/* Flags */}
          {evaluation.flags && evaluation.flags.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1">Flags:</p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc pl-4 space-y-0.5">
                {evaluation.flags.map((flag, i) => (
                  <li key={i}>{flag}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Methodology note */}
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            Scored by an independent AI evaluation against a rubric measuring factual accuracy,
            context inclusion, limitation acknowledgment, responsible framing, and query relevance.
          </p>
        </div>
      )}
    </div>
  );
}
