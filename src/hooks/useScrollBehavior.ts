'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface UseScrollBehaviorOptions {
  threshold?: number; // Distance from bottom to consider "at bottom" (default: 100px)
}

interface UseScrollBehaviorReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
  handleScroll: () => void;
}

export function useScrollBehavior(
  isStreaming: boolean,
  options: UseScrollBehaviorOptions = {}
): UseScrollBehaviorReturn {
  const { threshold = 100 } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const wasAtBottomBeforeStream = useRef(true);

  // Check if currently at bottom
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= threshold;
  }, [threshold]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
    setIsAtBottom(true);
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);
  }, [checkIfAtBottom]);

  // When streaming starts, remember if we were at bottom
  // When streaming ends and we were at bottom before, scroll to bottom
  useEffect(() => {
    if (isStreaming) {
      // Starting to stream - remember current position
      wasAtBottomBeforeStream.current = checkIfAtBottom();
    } else {
      // Streaming ended - if we were at bottom before, scroll down
      if (wasAtBottomBeforeStream.current) {
        // Use setTimeout to allow DOM to update
        setTimeout(() => {
          scrollToBottom();
        }, 0);
      }
    }
  }, [isStreaming, checkIfAtBottom, scrollToBottom]);

  // Initial check
  useEffect(() => {
    setIsAtBottom(checkIfAtBottom());
  }, [checkIfAtBottom]);

  return {
    containerRef,
    isAtBottom,
    scrollToBottom,
    handleScroll
  };
}
