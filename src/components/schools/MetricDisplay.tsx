'use client';

interface MetricDisplayProps {
  label: string;
  value: number | null;
  median?: number;
  format?: 'percent' | 'number';
  description?: string;
  showBar?: boolean;
}

export function MetricDisplay({
  label,
  value,
  median,
  format = 'percent',
  description,
  showBar = true
}: MetricDisplayProps) {
  const displayValue = value !== null
    ? format === 'percent'
      ? (value * 100).toFixed(0) + '%'
      : value.toLocaleString()
    : 'N/A';

  const comparison = value !== null && median !== undefined
    ? value > median + 0.05
      ? 'above'
      : value < median - 0.05
      ? 'below'
      : 'near'
    : null;

  const comparisonText = comparison
    ? `${comparison} median (${(median! * 100).toFixed(0)}%)`
    : null;

  const barWidth = value !== null && format === 'percent'
    ? Math.min(Math.max(value * 100, 0), 100)
    : 0;

  const barColor = comparison === 'above'
    ? 'bg-green-500'
    : comparison === 'below'
    ? 'bg-amber-500'
    : 'bg-blue-500';

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span className="text-lg font-semibold text-gray-900 dark:text-white">
          {displayValue}
        </span>
      </div>

      {showBar && value !== null && format === 'percent' && (
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        {description && <span>{description}</span>}
        {comparisonText && <span>{comparisonText}</span>}
      </div>
    </div>
  );
}

interface MetricComparisonProps {
  current: number | null;
  previous: number | null;
  label: string;
  format?: 'percent' | 'number';
}

export function MetricComparison({ current, previous, label, format = 'percent' }: MetricComparisonProps) {
  const formatValue = (v: number | null) => {
    if (v === null) return 'N/A';
    return format === 'percent' ? (v * 100).toFixed(0) + '%' : v.toLocaleString();
  };

  const change = current !== null && previous !== null
    ? current - previous
    : null;

  const changeDisplay = change !== null
    ? change > 0.05
      ? { text: `+${(change * 100).toFixed(0)}`, color: 'text-green-600 dark:text-green-400', icon: '↑' }
      : change < -0.05
      ? { text: (change * 100).toFixed(0), color: 'text-red-600 dark:text-red-400', icon: '↓' }
      : { text: '→', color: 'text-gray-500', icon: '' }
    : null;

  return (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">2023-24</p>
        <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
          {formatValue(previous)}
        </p>
      </div>

      {changeDisplay && (
        <span className={`text-lg font-bold ${changeDisplay.color}`}>
          {changeDisplay.icon} {changeDisplay.text}
        </span>
      )}

      <div className="text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">2024-25</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {formatValue(current)}
        </p>
      </div>
    </div>
  );
}
