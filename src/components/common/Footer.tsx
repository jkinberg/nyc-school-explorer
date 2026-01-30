import { School } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-8 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            <School className="w-4 h-4" />
            <span>NYC School Explorer</span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span>Data from NYC DOE School Quality Reports (2022-25)</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This tool is for educational exploration, not school choice recommendations.
          </p>
        </div>
      </div>
    </footer>
  );
}
