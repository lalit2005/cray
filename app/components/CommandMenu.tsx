import { useRef, useState, useEffect } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@remix-run/react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Chats } from "~/localdb";
import {
  FileText,
  Plus,
  Tag,
  PinIcon,
  Share2,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  MessageCircle,
} from "lucide-react";
import { syncAllData } from "~/lib/sync";
import toast from "react-hot-toast";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string | null;
  showNotesSidebar: boolean;
  setShowNotesSidebar: (show: boolean) => void;
}

export function CommandMenu({
  open,
  onOpenChange,
  chatId,
  showNotesSidebar,
  setShowNotesSidebar,
}: CommandMenuProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const chat = useLiveQuery(
    () => (chatId ? db.chats.where("id").equals(chatId).first() : undefined),
    [chatId]
  );

  // Get all chats for search
  const chats = useLiveQuery(() =>
    db.chats
      .where("inTrash")
      .equals(0)
      .toArray()
      .then((chats) =>
        chats.sort((a, b) => {
          // Sort by pinned first, then by updated date
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        })
      )
  ) as Chats[] | undefined;

  // Get chats with notes
  const chatsWithNotes = useLiveQuery(
    () => db.chats.where("notes").notEqual("").toArray(),
    [],
    []
  ) as Chats[] | undefined;

  useEffect(() => {
    if (open) {
      // Reset search when opening
      setSearch("");

      // Focus input with a small delay to ensure it's properly mounted
      const focusTimer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);

      return () => clearTimeout(focusTimer);
    }
  }, [open]);

  // Function to create a new chat
  const handleNewChat = () => {
    navigate("/?new");
    onOpenChange(false);
  };

  // Function to toggle notes sidebar
  const toggleNotes = () => {
    setShowNotesSidebar(!showNotesSidebar);
    onOpenChange(false);
  };

  // Function to toggle pin status
  const togglePin = async () => {
    if (!chat) return;
    try {
      const newIsPinned = chat.isPinned ? 0 : 1;
      await db.chats.update(chat.id, {
        isPinned: newIsPinned,
        updatedAt: new Date(),
      });
      toast.success(newIsPinned ? "Chat pinned" : "Chat unpinned");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update pin status");
      console.error(error);
    }
  };

  // Function to toggle share status
  const toggleShareStatus = async () => {
    if (!chat) return;
    try {
      const newIsPublic = chat.isPublic ? 0 : 1;
      await db.chats.update(chat.id, {
        isPublic: newIsPublic,
        updatedAt: new Date(),
      });
      toast.success(newIsPublic ? "Chat is now public" : "Chat is now private");
      if (newIsPublic) {
        const shareUrl = `${window.location.origin}/share?id=${chat.id}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Share link copied to clipboard!");
      }
      onOpenChange(false);

      // Also sync the changes to server
      try {
        syncAllData();
      } catch (syncError) {
        console.error(
          "Failed to sync after updating sharing status:",
          syncError
        );
      }
    } catch (error) {
      toast.error("Failed to update sharing status");
      console.error(error);
    }
  };

  // Function to move chat to trash
  const moveToTrash = async () => {
    if (!chat) return;
    if (confirm("Are you sure you want to delete this chat?")) {
      try {
        await db.chats.update(chat.id, {
          inTrash: 1,
          updatedAt: new Date(),
        });
        toast.success("Moved to trash");
        navigate("/");
        onOpenChange(false);
      } catch (error) {
        toast.error("Failed to delete chat");
        console.error(error);
      }
    }
  };

  // Function to copy share link
  const copyShareLink = async () => {
    if (!chat) return;
    if (!chat.isPublic) {
      toast.error("Chat must be public to copy share link");
      return;
    }
    try {
      const shareUrl = `${window.location.origin}/share?id=${chat.id}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard!");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to copy share link");
      console.error(error);
    }
  };

  // No need for this function as we're using inline handlers

  const handleSyncData = async () => {
    try {
      toast.loading("Syncing data...");
      const result = await syncAllData();
      toast.dismiss();
      toast.success(
        `Sync completed! Updated ${
          result.fetchedChats + result.receivedServerChanges
        } chats.`
      );
      onOpenChange(false);
    } catch (error) {
      toast.dismiss();
      toast.error(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // Function to copy all chat data with roles
  const copyAllChatData = async () => {
    if (!chatId) return;

    try {
      toast.loading("Preparing chat data...");

      // Get all messages for the current chat
      const messages = await db.messages
        .where("chatId")
        .equals(chatId)
        .sortBy("createdAt");

      if (!messages || messages.length === 0) {
        toast.dismiss();
        toast.error("No messages found in this chat");
        return;
      }

      // Format the messages with their roles in a way that's compatible with other AI apps
      const formattedMessages = messages
        .map((message) => {
          // Make role names consistent with what other AI apps expect
          const role =
            message.role === "assistant"
              ? "Assistant"
              : message.role === "user"
              ? "User"
              : message.role === "system"
              ? "System"
              : message.role;

          // Add a nice separator between messages
          return `### ${role}:\n${message.content}`;
        })
        .join("\n\n");

      // Add chat title and metadata
      let chatData = "";
      if (chat) {
        chatData = `# ${chat.title}\n`;
        chatData += `Date: ${new Date(chat.updatedAt).toLocaleString()}\n`;
        chatData += `Model: ${messages[0]?.model || "Unknown"}\n`;
        chatData += `Provider: ${messages[0]?.provider || "Unknown"}\n\n`;
        chatData += `----------------------------------------\n\n`;
      }

      chatData += formattedMessages;

      // Add footer with source info
      chatData += "\n\n----------------------------------------\n";
      chatData += "Exported from Cray Chat";

      // Copy to clipboard
      await navigator.clipboard.writeText(chatData);

      toast.dismiss();
      toast.success("Chat data copied to clipboard");
      onOpenChange(false);
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to copy chat data");
      console.error(error);
    }
  };

  // Helper function to check if an action matches the search query
  const actionMatchesSearch = (actionName: string) => {
    if (!search) return true;
    const searchLower = search.toLowerCase().trim();
    return actionName.toLowerCase().includes(searchLower);
  };

  // Function to highlight matched text in notes
  const highlightMatchedText = (
    text: string,
    query: string
  ): React.ReactNode => {
    if (!query || !text) return text;

    const searchLower = query.toLowerCase().trim();
    if (!text.toLowerCase().includes(searchLower)) return text;

    const index = text.toLowerCase().indexOf(searchLower);
    const before = text.substring(0, index);
    const match = text.substring(index, index + searchLower.length);
    const after = text.substring(index + searchLower.length);

    return (
      <>
        {before}
        <span className="text-amber-500">{match}</span>
        {after}
      </>
    );
  };

  // Filter chats based on search query with improved matching
  const filteredChats: Chats[] = Array.isArray(chats)
    ? chats.filter((chat: Chats) => {
        if (!search) return true;

        const searchLower = search.toLowerCase().trim();

        // Title match
        if (chat.title.toLowerCase().includes(searchLower)) return true;

        // Notes match - search in notes content
        if (chat.notes && chat.notes.toLowerCase().includes(searchLower))
          return true;

        // Tag match
        if (
          chat.tags &&
          chat.tags.some((tag) => tag.toLowerCase().includes(searchLower))
        )
          return true;

        // Match by words in the title
        const words = chat.title.toLowerCase().split(/\s+/);
        if (words.some((word) => word.startsWith(searchLower))) return true;

        // No match found
        return false;
      })
    : [];

  // Add dynamic stylesheet for keyboard navigation highlighting
  useEffect(() => {
    if (open) {
      const styleElement = document.createElement("style");
      styleElement.id = "cmdk-styles";
      styleElement.textContent = `
        /* Style for selected items with keyboard navigation */
        [cmdk-item][data-selected="true"] {
          background-color: rgba(39, 39, 42, 0.8) !important;
          color: white !important;
        }
        
        /* Additional style to ensure the highlighting is visible */
        [cmdk-item]:focus, [cmdk-item]:focus-visible {
          background-color: rgba(39, 39, 42, 0.8) !important;
          outline: none !important;
        }
        
        /* Make sure any active elements in the item also have proper contrast */
        [cmdk-item][data-selected="true"] * {
          color: inherit;
        }
      `;
      document.head.appendChild(styleElement);

      return () => {
        const existingStyle = document.getElementById("cmdk-styles");
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
      };
    }
  }, [open]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      id="cmdk-dialog"
      className="fixed top-[40%] left-[50%] max-h-[85vh] w-[90vw] max-w-[640px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] translucent shadow-2xl shadow-black p-0 focus:outline-none border border-zinc-800 overflow-hidden"
      loop
      shouldFilter={false} // We're handling filtering ourselves for custom behavior
    >
      <div className="overflow-hidden">
        <Command.Input
          ref={inputRef}
          value={search}
          onValueChange={setSearch}
          placeholder="Type to search chats or run a command..."
          className="w-full px-4 py-4 font-mono text-zinc-300 bg-zinc-950/70 border border-zinc-800 focus:outline-none"
        />

        <Command.List className="max-h-[400px] overflow-auto px-2 py-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent hover:scrollbar-thumb-zinc-600">
          <Command.Empty className="px-4 py-6 text-center text-zinc-500">
            No results found for &ldquo;{search}&rdquo;
          </Command.Empty>

          {/* Default commands - show when search is empty or matching */}
          {actionMatchesSearch("New Chat") && (
            <Command.Item
              onSelect={handleNewChat}
              className="flex items-center px-4 py-2 text-zinc-300 hover:bg-zinc-800 cursor-pointer rounded-md transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Command.Item>
          )}

          {actionMatchesSearch("Sync Data") && (
            <Command.Item
              onSelect={handleSyncData}
              value="Sync Data"
              className="flex items-center px-4 py-2 text-zinc-300 hover:bg-zinc-800 cursor-pointer rounded-md transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Data
            </Command.Item>
          )}

          {/* Chat-specific commands */}
          {chatId && chat && (
            <>
              {actionMatchesSearch(
                showNotesSidebar ? "Close Notes" : "Show Notes"
              ) && (
                <Command.Item
                  onSelect={toggleNotes}
                  className="flex items-center px-4 py-2 text-zinc-300 hover:bg-zinc-800 cursor-pointer rounded-md transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {showNotesSidebar ? "Close Notes" : "Show Notes"}
                </Command.Item>
              )}

              {actionMatchesSearch(
                chat.isPinned ? "Unpin Chat" : "Pin Chat"
              ) && (
                <Command.Item
                  onSelect={togglePin}
                  className="flex items-center px-4 py-2 text-zinc-300 hover:bg-zinc-800 cursor-pointer rounded-md transition-colors"
                >
                  <PinIcon className="w-4 h-4 mr-2" />
                  {chat.isPinned ? "Unpin Chat" : "Pin Chat"}
                </Command.Item>
              )}

              {actionMatchesSearch(
                chat.isPublic ? "Make Private" : "Make Public"
              ) && (
                <Command.Item
                  onSelect={toggleShareStatus}
                  className="flex items-center px-4 py-2 text-zinc-300 hover:bg-zinc-800 cursor-pointer rounded-md transition-colors"
                >
                  {chat.isPublic ? (
                    <EyeOff className="w-4 h-4 mr-2" />
                  ) : (
                    <Eye className="w-4 h-4 mr-2" />
                  )}
                  {chat.isPublic ? "Make Private" : "Make Public"}
                </Command.Item>
              )}

              {chat.isPublic
                ? actionMatchesSearch("Copy Share Link") && (
                    <Command.Item
                      onSelect={copyShareLink}
                      className="flex items-center px-4 py-2 text-zinc-300 hover:bg-zinc-800 cursor-pointer rounded-md transition-colors"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Copy Share Link
                    </Command.Item>
                  )
                : null}

              {actionMatchesSearch("Copy Chat Data") && (
                <Command.Item
                  onSelect={copyAllChatData}
                  className="flex items-center px-4 py-2 text-zinc-300 hover:bg-zinc-800 cursor-pointer rounded-md transition-colors"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Copy Chat Data
                </Command.Item>
              )}

              {actionMatchesSearch("Delete Chat") && (
                <Command.Item
                  onSelect={moveToTrash}
                  className="flex items-center px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-red-500 data-[selected=true]:text-red-500 group cursor-pointer rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2 group-hover:text-red-500 group-data-[selected=true]:text-red-500" />
                  <span className="group-hover:text-red-500 group-data-[selected=true]:text-red-500">
                    Delete Chat
                  </span>
                </Command.Item>
              )}
            </>
          )}

          {/* Display matching chats */}
          {filteredChats.map((chat) => (
            <Command.Item
              key={chat.id}
              value={`chat:${chat.title}`}
              onSelect={() => {
                navigate(`/?id=${chat.id}`);
                // Open notes sidebar if the search query matches the notes content
                if (
                  search &&
                  chat.notes &&
                  chat.notes.toLowerCase().includes(search.toLowerCase())
                ) {
                  setShowNotesSidebar(true);
                }
                onOpenChange(false);
              }}
              className="flex items-center px-4 py-2 text-zinc-300 hover:bg-zinc-800 cursor-pointer rounded-md transition-colors relative"
            >
              <MessageCircle className="flex-shrink-0" />
              <div className="flex-1 overflow-hidden">
                <div className="truncate">
                  {chat.title}
                  <span className="!text-zinc-500 text-xs ml-2">
                    {new Date(chat.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs !text-zinc-500 flex items-center gap-2 absolute right-2 top-1/2 transform -translate-y-1/2">
                  {chat.notes && chat.notes.trim() !== "" && (
                    <span className="flex items-center gap-1" title="Has notes">
                      <FileText className="h-3 w-3" />
                    </span>
                  )}
                  {chat.tags && chat.tags.length > 10 && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {chat.tags.length - 10}
                    </span>
                  )}
                  {chat.isPinned ? (
                    <PinIcon className="h-3 w-3 !text-amber-500" />
                  ) : null}
                </div>
              </div>
            </Command.Item>
          ))}

          {/* Display chats with notes when search matches note content or includes "note" */}
          {search &&
            Array.isArray(chatsWithNotes) &&
            chatsWithNotes.length > 0 &&
            chatsWithNotes
              .filter(
                (chat) =>
                  search.toLowerCase().includes("note") ||
                  (chat.notes &&
                    chat.notes.toLowerCase().includes(search.toLowerCase()))
              )
              .map((chat: Chats) => (
                <Command.Item
                  key={`note-${chat.id}`}
                  value={`note:${chat.title} ${chat.notes}`}
                  onSelect={() => {
                    navigate(`/?id=${chat.id}`);
                    setShowNotesSidebar(true);
                    onOpenChange(false);
                  }}
                  className="flex items-center px-4 py-2 text-zinc-300 hover:bg-zinc-800 cursor-pointer rounded-md transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <div className="truncate font-medium">{chat.title}</div>
                    <div className="text-xs text-zinc-500 truncate">
                      {search &&
                      chat.notes &&
                      search.trim() !== "" &&
                      chat.notes.toLowerCase().includes(search.toLowerCase())
                        ? highlightMatchedText(chat.notes, search)
                        : chat.notes}
                    </div>
                  </div>
                </Command.Item>
              ))}
        </Command.List>

        <div className="p-2 border-t border-zinc-800">
          <div className="px-2 text-xs text-zinc-500 flex items-center justify-between">
            <div>
              <kbd className="px-1 py-0.5 text-xs rounded bg-zinc-800 uppercase">
                esc
              </kbd>
              <span className="ml-1">to close</span>
            </div>
            <div>
              <kbd className="px-1 py-0.5 text-xs rounded bg-zinc-800 uppercase">
                ↑↓
              </kbd>
              <span className="ml-1">to navigate</span>
            </div>
          </div>
        </div>
      </div>
    </Command.Dialog>
  );
}
