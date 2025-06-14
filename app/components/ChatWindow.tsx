import { Message, useChat } from "@ai-sdk/react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import { Button } from "./ui/Button";
import { useEffect, useRef, useState } from "react";
import { db, Messages } from "~/localdb";
import { useSearchParams, useNavigate } from "@remix-run/react";
import { useLiveQuery } from "dexie-react-hooks";

export const ChatWindow = () => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const chatId = searchParams.get("id");
  const messages = useLiveQuery(
    () =>
      chatId
        ? db.messages.where("chatId").equals(chatId).sortBy("createdAt")
        : [],
    [chatId],
    []
  ) as Message[]; // Provide initial empty array

  const isLoading = messages === undefined;

  useEffect(() => {
    const newParam = searchParams.get("new");
    if (newParam) {
      // Clear messages by removing chatId from URL
      navigate("/?new");
    }
  }, [searchParams]);

  const { input, handleInputChange, handleSubmit } = useChat({
    api: "http://localhost:8787/chat",
    onFinish: (msg) => {
      // We should have a chatId by now
      if (!chatId) {
        throw new Error("No chatId set when storing assistant message");
      }

      // Store assistant message
      db.messages.add({
        id: msg.id,
        chatId,
        role: msg.role as Message["role"],
        content: msg.content,
        createdAt: new Date(),
      });

      inputRef.current?.focus();

      // Scroll to bottom
      messagesContainerRef.current?.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    },
    initialMessages: messages,
  });

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        e.ctrlKey &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeydown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [inputRef]);

  const sendMessage = async () => {
    if (input.trim() === "") return;

    let currentChatId = chatId;
    if (!currentChatId) {
      // Create new chat
      currentChatId = crypto.randomUUID();
      await db.chats.add({
        id: currentChatId,
        title: input.substring(0, 30),
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        inTrash: 0,
        isPinned: 0,
        notes: "",
        messages: [],
      });
      navigate(`/?id=${currentChatId}`);
    }

    // Store user message
    await db.messages.add({
      id: crypto.randomUUID(),
      chatId: currentChatId,
      role: "user",
      content: input,
      createdAt: new Date(),
    });

    // Update chat's updatedAt
    await db.chats.update(currentChatId, { updatedAt: new Date() });

    // Submit to assistant
    handleSubmit();
  };

  return (
    <div>
      <div
        className="p-5 pt-10 space-y-4 max-w-7xl mx-auto h-[calc(100vh-200px)] overflow-y-auto"
        ref={messagesContainerRef}
      >
        {isLoading ? (
          <div className="text-center py-10">Loading messages...</div>
        ) : (
          messages.map((message: Message) => (
            <div
              key={message.id}
              className="flex items-center justify-center"
              id="chatWindow"
            >
              <div
                className={clsx(
                  "p-4 py-2 rounded overflow-x-scroll w-full",
                  message.role === "user"
                    ? "bg-zinc-800 max-w-[40%] ml-auto"
                    : "bg-zinc-900 max-w-[70%] mr-auto"
                )}
              >
                <ReactMarkdown>{message.content}</ReactMarkdown>
                <p className="text-xs text-zinc-500 mt-2">
                  {message.createdAt?.toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="text-center sticky bottom-0  mb-5 p-4">
        <div className="mx-auto flex justify-center items-center w-full max-w-3xl max-h-32">
          <textarea
            className="p-2 rounded-lg h-full px-5 py-3 resize-none border-2 border-zinc-800 shadow-2xl shadow-zinc-800 w-full"
            placeholder="Type your message (Ctrl/Cmd + / to focus)..."
            rows={3}
            value={input}
            onChange={handleInputChange}
            ref={inputRef}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            onClick={sendMessage}
            className="bg-opacity-100! relative -left-20 focus:shadow focus:shadow-amber-700 focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
