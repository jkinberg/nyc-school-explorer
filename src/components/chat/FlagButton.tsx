'use client';

import { useState, useRef, useEffect } from 'react';
import type { EvaluationResult } from '@/types/chat';
import type { ToolExecution } from './ToolCallDisplay';

interface FlagButtonProps {
  messageId: string;
  userQuery: string;
  assistantResponse: string;
  toolCalls?: ToolExecution[];
  evaluation?: EvaluationResult;
}

export function FlagButton({
  messageId,
  userQuery,
  assistantResponse,
  toolCalls,
  evaluation
}: FlagButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_FEEDBACK_LENGTH = 1000;

  // Focus textarea when modal opens and handle Escape key
  useEffect(() => {
    if (isOpen) {
      // Focus the textarea after a short delay to ensure modal is rendered
      setTimeout(() => textareaRef.current?.focus(), 50);

      // Close on Escape key
      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      }
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!feedback.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Convert tool executions to the format expected by the API
      const toolCallsForApi = toolCalls?.map(tc => ({
        name: tc.name,
        parameters: tc.parameters || {}
      })) || [];

      const response = await fetch('/api/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          user_query: userQuery,
          assistant_response: assistantResponse,
          tool_calls: toolCallsForApi,
          evaluation,
          feedback: feedback.trim()
        })
      });

      if (response.ok) {
        setIsSubmitted(true);
        setIsOpen(false);
      } else {
        console.error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show checkmark if already submitted
  if (isSubmitted) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Feedback submitted
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        aria-label="Flag this response"
        title="Flag this response for review"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
        Flag
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flag-modal-title"
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="flag-modal-title" className="text-lg font-medium text-gray-900 dark:text-white">
                  Flag this response
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <label className="block text-sm text-gray-600 dark:text-gray-400">
                What was wrong with this response?
              </label>

              <textarea
                ref={textareaRef}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value.slice(0, MAX_FEEDBACK_LENGTH))}
                placeholder="Describe the issue (e.g., incorrect information, missing context, misleading framing...)"
                className="w-full h-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                disabled={isSubmitting}
              />

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {feedback.length}/{MAX_FEEDBACK_LENGTH}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!feedback.trim() || isSubmitting}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </span>
                    ) : (
                      'Submit'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
