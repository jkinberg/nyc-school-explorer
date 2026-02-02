'use client';

import { ArrowDown } from 'lucide-react';

interface ScrollToBottomButtonProps {
  onClick: () => void;
  visible: boolean;
}

export function ScrollToBottomButton({ onClick, visible }: ScrollToBottomButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute bottom-24 right-8 z-10 flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 animate-fade-in"
      aria-label="Scroll to bottom"
    >
      <ArrowDown className="w-4 h-4" />
      <span className="text-sm font-medium">New messages</span>
    </button>
  );
}
