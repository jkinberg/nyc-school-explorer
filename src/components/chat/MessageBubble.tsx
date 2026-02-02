'use client';

import { ConfidenceBadge } from './ConfidenceBadge';
import { ChartRenderer } from './ChartRenderer';
import { MarkdownRenderer, SchoolMapping } from './MarkdownRenderer';
import { ToolCallDisplay, ToolExecution } from './ToolCallDisplay';
import type { EvaluationResult, ChartData } from '@/types/chat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isStreaming?: boolean;
  isEvaluating?: boolean;
  evaluation?: EvaluationResult;
  charts?: ChartData[];
  toolExecutions?: ToolExecution[];
  schoolMappings?: SchoolMapping;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-blue-600 text-white">
          <p>{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white">
          {/* Tool executions shown ABOVE text content (chronological order) */}
          {message.toolExecutions && message.toolExecutions.length > 0 && (
            <ToolCallDisplay executions={message.toolExecutions} />
          )}

          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <>
              <MarkdownRenderer content={message.content} schoolMappings={message.schoolMappings} />
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-gray-400 dark:bg-gray-500 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </>
          )}
          {message.charts && message.charts.length > 0 && (
            <>
              {message.charts.map((chart, idx) => (
                <ChartRenderer key={idx} chart={chart} />
              ))}
            </>
          )}
        </div>
        {message.isEvaluating && (
          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500 animate-pulse">
            Evaluating response...
          </p>
        )}
        {message.evaluation && (
          <ConfidenceBadge evaluation={message.evaluation} />
        )}
      </div>
    </div>
  );
}
