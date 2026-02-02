'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { SuggestedQueries } from './SuggestedQueries';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { useScrollBehavior } from '@/hooks/useScrollBehavior';
import { generateId } from '@/lib/utils/formatting';
import type { EvaluationResult, ChartData } from '@/types/chat';
import type { ToolExecution } from './ToolCallDisplay';
import type { SchoolMapping } from './MarkdownRenderer';

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
  userQuery?: string; // The user query this response answers (for flagging)
}

interface SuggestedQuery {
  text: string;
  category: string;
}

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

interface ChatInterfaceProps {
  initialQuery?: string;
}

const INITIAL_SUGGESTIONS: SuggestedQuery[] = [
  { text: 'Show me high growth schools in the Bronx', category: 'explore' },
  { text: 'What does Impact Score measure?', category: 'explain' },
  { text: 'Find schools with strong growth serving high-poverty populations', category: 'explore' },
  { text: 'How does poverty correlate with test scores?', category: 'explore' },
];

function parseSSEEvents(buffer: string): { parsed: SSEEvent[]; remaining: string } {
  const parsed: SSEEvent[] = [];
  const blocks = buffer.split('\n\n');

  // The last element may be incomplete — keep it as remaining
  const remaining = blocks.pop() || '';

  for (const block of blocks) {
    if (!block.trim()) continue;

    let eventType = '';
    let eventData = '';

    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7);
      } else if (line.startsWith('data: ')) {
        eventData = line.slice(6);
      }
    }

    if (eventType && eventData) {
      try {
        parsed.push({ type: eventType, data: JSON.parse(eventData) });
      } catch {
        // Skip malformed events
      }
    }
  }

  return { parsed, remaining };
}

export function ChatInterface({ initialQuery }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQueries, setSuggestedQueries] = useState<SuggestedQuery[]>(INITIAL_SUGGESTIONS);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if any message is currently streaming
  const isStreaming = messages.some(m => m.isStreaming);

  // Use scroll behavior hook
  const { containerRef, isAtBottom, scrollToBottom, handleScroll } = useScrollBehavior(isStreaming);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialQuerySentRef = useRef(false);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    setError(null);
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date()
    };

    // Add user message
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    // Add loading message with reference to user query for flagging
    const loadingId = generateId();
    setMessages(prev => [...prev, {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      toolExecutions: [],
      userQuery: messageText.trim() // Store the user query this response answers
    }]);
    setIsLoading(true);

    try {
      // Prepare messages for API (last 10 messages to manage context)
      const recentMessages = [...messages, userMessage]
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: recentMessages })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get response');
      }

      // Read SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let hasReceivedText = false;

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });

        const { parsed, remaining } = parseSSEEvents(buffer);
        buffer = remaining;

        for (const event of parsed) {
          switch (event.type) {
            case 'text_delta': {
              const text = event.data.text as string;
              if (!hasReceivedText) {
                hasReceivedText = true;
                // First text delta: transition from loading to streaming
                setMessages(prev => prev.map(m =>
                  m.id === loadingId
                    ? { ...m, content: text, isLoading: false, isStreaming: true }
                    : m
                ));
              } else {
                // Subsequent deltas: append text
                setMessages(prev => prev.map(m =>
                  m.id === loadingId
                    ? { ...m, content: m.content + text }
                    : m
                ));
              }
              break;
            }

            case 'tool_start': {
              // Enhanced: now includes id, name, and parameters
              const { id, name, parameters } = event.data as {
                id: string;
                name: string;
                parameters?: Record<string, unknown>;
              };

              // Add tool execution to message
              setMessages(prev => prev.map(m => {
                if (m.id !== loadingId) return m;
                const newExecution: ToolExecution = {
                  id,
                  name,
                  parameters,
                  status: 'running'
                };
                return {
                  ...m,
                  isLoading: !hasReceivedText, // Keep loading state if no text yet
                  toolExecutions: [...(m.toolExecutions || []), newExecution]
                };
              }));
              break;
            }

            case 'tool_end': {
              // Enhanced: now includes id, name, resultSummary, and schools for linking
              const { id, name, resultSummary, error: toolError, schools } = event.data as {
                id: string;
                name: string;
                resultSummary?: string;
                error?: string;
                schools?: Array<{ name: string; dbn: string }>;
              };

              // Update tool execution status and add school mappings
              setMessages(prev => prev.map(m => {
                if (m.id !== loadingId) return m;

                // Merge new school mappings
                const newMappings = new Map(m.schoolMappings || []);
                if (schools) {
                  for (const school of schools) {
                    if (school.name && school.dbn) {
                      newMappings.set(school.name, school.dbn);
                    }
                  }
                }

                return {
                  ...m,
                  schoolMappings: newMappings.size > 0 ? newMappings : m.schoolMappings,
                  toolExecutions: (m.toolExecutions || []).map(te =>
                    te.id === id
                      ? {
                          ...te,
                          status: toolError ? 'error' as const : 'completed' as const,
                          resultSummary,
                          error: toolError,
                          schools
                        }
                      : te
                  )
                };
              }));
              break;
            }

            case 'chart_data': {
              // Layer 1: Receive full chart data sent separately from Claude's conversation
              const chartData = event.data as { toolUseId: string; chart: ChartData; _context: unknown };
              if (chartData.chart) {
                setMessages(prev => prev.map(m =>
                  m.id === loadingId
                    ? { ...m, charts: [...(m.charts || []), chartData.chart] }
                    : m
                ));
              }
              break;
            }

            case 'done': {
              const evaluating = event.data.evaluating as boolean;
              const loadingSuggestions = event.data.suggestionsLoading as boolean;
              // Mark streaming complete, set evaluating state
              setMessages(prev => prev.map(m =>
                m.id === loadingId
                  ? { ...m, isStreaming: false, isEvaluating: evaluating === true }
                  : m
              ));
              setSuggestionsLoading(loadingSuggestions === true);
              break;
            }

            case 'suggested_queries': {
              const suggestions = event.data.suggestions as SuggestedQuery[];
              if (suggestions?.length > 0) {
                setSuggestedQueries(suggestions);
              }
              setSuggestionsLoading(false);
              break;
            }

            case 'evaluation': {
              const evaluation = event.data as unknown as EvaluationResult;
              setMessages(prev => prev.map(m =>
                m.id === loadingId
                  ? { ...m, isEvaluating: false, evaluation }
                  : m
              ));
              break;
            }

            case 'error':
              throw new Error(event.data.error as string);
          }
        }
      }

      // Clean up isEvaluating and suggestionsLoading in case they timed out
      setMessages(prev => prev.map(m =>
        m.id === loadingId && m.isEvaluating ? { ...m, isEvaluating: false } : m
      ));
      setSuggestionsLoading(false);

    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');

      // Remove loading message
      setMessages(prev => prev.filter(m => m.id !== loadingId));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  // Send initial query on mount
  useEffect(() => {
    if (initialQuery && !initialQuerySentRef.current) {
      initialQuerySentRef.current = true;
      sendMessage(initialQuery);
    }
  }, [initialQuery, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestionClick = (query: string) => {
    sendMessage(query);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-gray-900 relative">
      {/* Messages area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Explore NYC School Data
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              Ask questions about school quality, student growth, and educational equity
              in NYC public schools.
            </p>
            <SuggestedQueries
              queries={suggestedQueries}
              onSelect={handleSuggestionClick}
            />
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
              />
            ))}

            {/* Show suggestions after responses */}
            {!isLoading && messages.length > 0 && (
              <div className="pt-4">
                <SuggestedQueries
                  queries={suggestedQueries}
                  onSelect={handleSuggestionClick}
                  compact
                  loading={suggestionsLoading}
                />
              </div>
            )}
          </>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      <ScrollToBottomButton
        visible={!isAtBottom && messages.length > 0}
        onClick={scrollToBottom}
      />

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about NYC schools..."
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Send'
            )}
          </button>
        </form>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Data from NYC DOE School Quality Reports (2023-24, 2024-25).
          AI responses should be verified.
        </p>
      </div>
    </div>
  );
}
