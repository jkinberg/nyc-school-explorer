'use client';

interface SuggestedQuery {
  text: string;
  category: string;
}

interface SuggestedQueriesProps {
  queries: SuggestedQuery[];
  onSelect: (query: string) => void;
  compact?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  explore: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50',
  explain: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50',
  compare: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50',
  visualize: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50',
};

export function SuggestedQueries({ queries, onSelect, compact }: SuggestedQueriesProps) {
  if (queries.length === 0) return null;

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {!compact && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Try asking:
        </p>
      )}
      <div className={`flex flex-wrap gap-2 ${compact ? 'justify-start' : 'justify-center'}`}>
        {queries.map((query, index) => (
          <button
            key={index}
            onClick={() => onSelect(query.text)}
            className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
              CATEGORY_COLORS[query.category] || CATEGORY_COLORS.explore
            }`}
          >
            {query.text}
          </button>
        ))}
      </div>
    </div>
  );
}
