'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, Wrench } from 'lucide-react';

// Human-readable tool labels
const TOOL_LABELS: Record<string, string> = {
  search_schools: 'Search Schools',
  get_school_profile: 'Get School Profile',
  find_similar_schools: 'Find Similar Schools',
  analyze_correlations: 'Analyze Correlations',
  generate_chart: 'Generate Chart',
  explain_metrics: 'Explain Metrics',
  get_curated_lists: 'Get Curated Lists',
};

export interface ToolExecution {
  id: string;
  name: string;
  parameters?: Record<string, unknown>;
  status: 'running' | 'completed' | 'error';
  resultSummary?: string;
  error?: string;
  schools?: Array<{ name: string; dbn: string }>;
}

interface ToolCallDisplayProps {
  executions: ToolExecution[];
}

interface ToolCardProps {
  execution: ToolExecution;
}

function formatParameters(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      const formattedValue = typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
      parts.push(`${key}: ${formattedValue}`);
    }
  }
  return parts.join(', ');
}

function ToolCard({ execution }: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const label = TOOL_LABELS[execution.name] || execution.name;

  const hasDetails = execution.parameters || execution.resultSummary || execution.error || (execution.schools && execution.schools.length > 0);

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        disabled={!hasDetails}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left ${
          hasDetails ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50' : 'cursor-default'
        }`}
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          <Wrench className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </div>

        {/* Tool name */}
        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>

        {/* Status indicator */}
        <div className="flex-shrink-0">
          {execution.status === 'running' && (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          )}
          {execution.status === 'completed' && (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
          {execution.status === 'error' && (
            <span className="w-4 h-4 text-red-500 font-bold">!</span>
          )}
        </div>

        {/* Expand/collapse indicator */}
        {hasDetails && (
          <div className="flex-shrink-0 text-gray-400">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-gray-700">
          {execution.parameters && Object.keys(execution.parameters).length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Parameters
              </span>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-mono">
                {formatParameters(execution.parameters)}
              </p>
            </div>
          )}

          {execution.resultSummary && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Result
              </span>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {execution.resultSummary}
              </p>
            </div>
          )}

          {execution.schools && execution.schools.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Schools
              </span>
              <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                {execution.schools.map((school) => (
                  <li key={school.dbn}>
                    <Link
                      href={`/school/${school.dbn}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {school.name}
                    </Link>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                      ({school.dbn})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {execution.error && (
            <div>
              <span className="text-xs font-medium text-red-500 uppercase tracking-wide">
                Error
              </span>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {execution.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallDisplay({ executions }: ToolCallDisplayProps) {
  if (!executions || executions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-3">
      {executions.map((execution) => (
        <ToolCard key={execution.id} execution={execution} />
      ))}
    </div>
  );
}
