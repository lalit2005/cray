import React, { useState, useEffect, useMemo, memo } from "react";
import { Message as MessageComponent } from "./Message";
import { Message } from "./types";
import clsx from "clsx";

interface MessageListProps {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const MessageList = memo(function MessageList({
  messages,
  messagesEndRef,
}: MessageListProps) {
  // Filter out any unnecessary messages
  const filteredMessages = useMemo(
    () =>
      messages.filter((msg, idx, arr) => {
        // Remove any empty non-loading assistant messages (likely duplicates)
        if (msg.role === "assistant" && !msg.loading && !msg.content.trim()) {
          return false;
        }
        // Remove duplicate consecutive loading assistant messages with no content
        if (
          msg.role === "assistant" &&
          msg.loading &&
          !msg.content.trim() &&
          idx > 0 &&
          arr[idx - 1].role === "assistant" &&
          arr[idx - 1].loading &&
          !arr[idx - 1].content.trim()
        ) {
          return false;
        }
        return true;
      }),
    [messages]
  );

  // Simplified virtualization approach
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  // Simplified check for whether to use virtualization
  // Skip virtualization for small lists or during typing
  const shouldVirtualize = useMemo(() => {
    // Skip virtualization for small message lists
    if (filteredMessages.length <= 30) return false;

    // Skip virtualization during typing (most critical fix)
    try {
      // @ts-expect-error - Accessing custom property
      const isTyping = window.__crayIsTyping?.current === true;
      if (isTyping) return false;
    } catch (e) {
      // Ignore error
    }

    return true;
  }, [filteredMessages.length]);

  // This effect updates which messages are visible based on scroll position
  useEffect(() => {
    if (!containerRef || !shouldVirtualize) return;

    const updateVisibleMessages = () => {
      // Skip virtualization during typing
      try {
        // @ts-expect-error - Accessing custom property
        const isTyping = window.__crayIsTyping?.current === true;
        if (isTyping) return;
      } catch (e) {
        // Ignore error
      }

      const containerHeight = window.innerHeight;
      const scrollTop = window.scrollY;

      // OPTIMIZATION: Larger buffer and more efficient calculation
      const avgMessageHeight = 100; // More conservative average height
      const visibleCount = Math.ceil(containerHeight / avgMessageHeight) + 30; // Increased buffer

      // Calculate which messages should be visible
      const estimatedStart = Math.max(
        0,
        Math.floor(scrollTop / avgMessageHeight) - 10
      );
      const estimatedEnd = Math.min(
        filteredMessages.length,
        estimatedStart + visibleCount
      );

      setVisibleRange({ start: estimatedStart, end: estimatedEnd });
    };

    // Initial calculation - for small lists just show everything
    if (!shouldVirtualize) {
      setVisibleRange({ start: 0, end: filteredMessages.length });
    } else {
      // Delay initial virtualization slightly to prevent blocking initial render
      const initialTimer = setTimeout(updateVisibleMessages, 50);
      return () => clearTimeout(initialTimer);
    }

    // Use passive listener with throttling for better performance
    let ticking = false;
    const scrollHandler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateVisibleMessages();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", scrollHandler, { passive: true });
    return () => window.removeEventListener("scroll", scrollHandler);
  }, [containerRef, filteredMessages.length, shouldVirtualize]);

  // Simplified message elements creation
  const messageElements = useMemo(() => {
    // If not using virtualization, just render all messages
    if (!shouldVirtualize) {
      return filteredMessages.map((message) => (
        <MessageComponent key={message.id} message={message} />
      ));
    }

    // During typing, also render all messages to avoid lag
    try {
      // @ts-expect-error - Accessing custom property
      const isTyping = window.__crayIsTyping?.current === true;
      if (isTyping) {
        return filteredMessages.map((message) => (
          <MessageComponent key={message.id} message={message} />
        ));
      }
    } catch (e) {
      // Ignore errors accessing property
    }

    const elements = [];

    // Add placeholders for messages above visible range
    if (visibleRange.start > 0) {
      const height = visibleRange.start * 100; // Approximate height
      elements.push(
        <div
          key="top-placeholder"
          style={{ height: `${height}px` }}
          className="min-h-[10px]"
        />
      );
    }

    // Add visible messages with improved slicing
    elements.push(
      ...filteredMessages
        .slice(visibleRange.start, visibleRange.end)
        .map((message) => (
          <MessageComponent key={message.id} message={message} />
        ))
    );

    // Add placeholders for messages below visible range
    if (visibleRange.end < filteredMessages.length) {
      const height = (filteredMessages.length - visibleRange.end) * 100; // Approximate height
      elements.push(
        <div
          key="bottom-placeholder"
          style={{ height: `${height}px` }}
          className="min-h-[10px]"
        />
      );
    }

    return elements;
  }, [filteredMessages, visibleRange, shouldVirtualize]);

  // CRITICAL FIX: During typing, completely disable virtualization
  // This ensures input is fully responsive regardless of message count
  const [isUserTyping, setIsUserTyping] = useState(false);

  // Effect to monitor typing state and disable virtualization during typing
  useEffect(() => {
    const checkTypingState = () => {
      try {
        // @ts-expect-error - Accessing custom property
        const typing = window.__crayIsTyping?.current === true;
        if (typing !== isUserTyping) {
          setIsUserTyping(typing);
        }
      } catch (e) {
        // Ignore errors accessing the property
      }
    };

    // Check initial state
    checkTypingState();

    // Set up an interval to check typing state
    // This ensures we respond to typing state changes
    const typingCheckInterval = setInterval(checkTypingState, 100);
    return () => clearInterval(typingCheckInterval);
  }, [isUserTyping]);

  return (
    <div
      ref={setContainerRef}
      className={clsx(
        "max-w-7xl mx-auto w-full space-y-4",
        isUserTyping ? "data-user-typing" : ""
      )}
    >
      {isUserTyping
        ? // Show just visible messages without virtualization during typing
          filteredMessages.map((message) => (
            <MessageComponent key={message.id} message={message} />
          ))
        : messageElements}
      <div ref={messagesEndRef} />
    </div>
  );
});
