'use client';

import { ConfidenceBadge } from './ConfidenceBadge';
import { ChartRenderer } from './ChartRenderer';
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
}

interface MessageBubbleProps {
  message: Message;
}

// Simple markdown-like rendering
function renderContent(content: string): React.ReactNode {
  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    // Code block
    if (part.startsWith('```')) {
      const code = part.replace(/```\w*\n?/g, '').trim();
      return (
        <pre key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto my-2 text-sm">
          <code>{code}</code>
        </pre>
      );
    }

    // Regular text with basic formatting
    return (
      <div key={i} className="prose dark:prose-invert max-w-none">
        {part.split('\n\n').map((paragraph, j) => {
          // Headers
          if (paragraph.startsWith('## ')) {
            return (
              <h3 key={j} className="text-lg font-semibold mt-4 mb-2">
                {paragraph.replace('## ', '')}
              </h3>
            );
          }
          if (paragraph.startsWith('### ')) {
            return (
              <h4 key={j} className="text-base font-semibold mt-3 mb-1">
                {paragraph.replace('### ', '')}
              </h4>
            );
          }

          // Lists
          if (paragraph.includes('\n- ') || paragraph.startsWith('- ')) {
            const items = paragraph.split('\n').filter(line => line.startsWith('- '));
            return (
              <ul key={j} className="list-disc pl-5 my-2 space-y-1">
                {items.map((item, k) => (
                  <li key={k}>{formatInlineText(item.replace('- ', ''))}</li>
                ))}
              </ul>
            );
          }

          // Numbered lists
          if (/^\d+\.\s/.test(paragraph)) {
            const items = paragraph.split('\n').filter(line => /^\d+\.\s/.test(line));
            return (
              <ol key={j} className="list-decimal pl-5 my-2 space-y-1">
                {items.map((item, k) => (
                  <li key={k}>{formatInlineText(item.replace(/^\d+\.\s/, ''))}</li>
                ))}
              </ol>
            );
          }

          // Regular paragraph
          if (paragraph.trim()) {
            return (
              <p key={j} className="my-2">
                {formatInlineText(paragraph)}
              </p>
            );
          }

          return null;
        })}
      </div>
    );
  });
}

// Format inline text (bold, italic, code)
function formatInlineText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(remaining.slice(0, boldMatch.index));
      }
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(remaining.slice(0, codeMatch.index));
      }
      parts.push(
        <code key={key++} className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    // No more formatting, add remaining text
    parts.push(remaining);
    break;
  }

  return parts;
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
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <>
              {renderContent(message.content)}
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
