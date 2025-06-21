import {
  FileText,
  Trash2,
  Wifi,
  Database,
  XCircle,
  RefreshCw,
  AlertCircle,
  Tag,
  Share2,
  Command as CommandIcon,
} from "lucide-react";
import { db } from "~/localdb";
import toast from "react-hot-toast";
import { useSearchParams } from "@remix-run/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, useRef } from "react";
import debounce from "lodash/debounce";
import { syncAllData } from "~/lib/sync";
import { CommandMenu } from "~/components/CommandMenu";

function Separator() {
  return <span className=""> &bull; </span>;
}

function StatusBar() {
  const [searchParams] = useSearchParams();
  const chatId = searchParams.get("id") || "";
  const allChatsCount = useLiveQuery(() => db.chats.count()) || 0;
  const messagesCount = useLiveQuery(() => db.messages.count()) || 0;
  const chat = useLiveQuery(
    () => db.chats.where("id").equals(chatId).first(),
    [chatId]
  );
  const [syncStatus, setSyncStatus] = useState<"SYNCING" | "SYNCED" | "ERROR">(
    "SYNCED"
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showNotesSidebar, setShowNotesSidebar] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const tagsInputRef = useRef<HTMLInputElement>(null);
  const focusModeRef = useRef<"tags" | null>(null);
  // Add state for command menu
  const [cmdkOpen, setCmdkOpen] = useState(false);

  // Determine if we're in development mode
  const isDevelopment = import.meta.env.DEV;

  // Update notes from chat data and set focus when sidebar opens
  useEffect(() => {
    if (showNotesSidebar && tagsInputRef.current) {
      tagsInputRef.current.focus();
      focusModeRef.current = null;
    }
  }, [showNotesSidebar]);

  // Add keyboard shortcut (Alt+N/Option+N) to toggle notes sidebar
  // and add Command+K / Ctrl+K to toggle command menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Support Command+K / Ctrl+K to toggle command menu
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdkOpen((open) => !open);
        return;
      }

      // Support both Alt+N (Windows/Linux) and Option+N (Mac)
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();

        // If we're about to close the sidebar, ensure notes are saved first
        if (showNotesSidebar && notesTextareaRef.current) {
          const value = notesTextareaRef.current.value;
          // Force an immediate save instead of debounced
          if (chatId && value !== chat?.notes) {
            db.chats.update(chatId, {
              notes: value,
              updatedAt: new Date(),
            });
          }
        }

        if (!showNotesSidebar) {
          focusModeRef.current = "tags";
          setShowNotesSidebar(true);
        } else {
          // Ensure notes are saved before closing
          if (notesTextareaRef.current) {
            const value = notesTextareaRef.current.value;
            if (chatId && value !== chat?.notes) {
              db.chats.update(chatId, {
                notes: value,
                updatedAt: new Date(),
              });
            }
          }
          setShowNotesSidebar(false);
        }
      }

      // Close notes with Escape key
      if (e.key === "Escape" && showNotesSidebar) {
        // Ensure notes are saved before closing
        if (notesTextareaRef.current) {
          const value = notesTextareaRef.current.value;
          // Force an immediate save instead of debounced
          if (chatId && value !== chat?.notes) {
            db.chats.update(chatId, {
              notes: value,
              updatedAt: new Date(),
            });
          }
        }

        setShowNotesSidebar(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showNotesSidebar, chatId, chat?.notes]);

  // Get sync status from localStorage
  useEffect(() => {
    const storedSyncStatus = localStorage.getItem("syncStatus");
    if (
      storedSyncStatus === "SYNCING" ||
      storedSyncStatus === "SYNCED" ||
      storedSyncStatus === "ERROR"
    ) {
      setSyncStatus(storedSyncStatus);

      if (storedSyncStatus === "ERROR") {
        const error = localStorage.getItem("syncError");
        setSyncError(error);
      } else {
        setSyncError(null);
      }
    }

    // Listen for changes to syncStatus in localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === "syncStatus" &&
        (e.newValue === "SYNCING" ||
          e.newValue === "SYNCED" ||
          e.newValue === "ERROR")
      ) {
        setSyncStatus(e.newValue as "SYNCING" | "SYNCED" | "ERROR");

        if (e.newValue === "ERROR") {
          const error = localStorage.getItem("syncError");
          setSyncError(error);
        } else {
          setSyncError(null);
        }
      }
    };

    // Listen for custom sync status change events
    const handleSyncStatusChange = (
      e: CustomEvent<{ status: "SYNCING" | "SYNCED" | "ERROR"; error?: string }>
    ) => {
      setSyncStatus(e.detail.status);
      setSyncError(e.detail.error || null);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "syncStatusChange",
      handleSyncStatusChange as EventListener
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "syncStatusChange",
        handleSyncStatusChange as EventListener
      );
    };
  }, []);

  // Debounced function to save notes silently
  const debouncedSaveNotes = useRef(
    debounce(async (value: string) => {
      if (chatId) {
        try {
          await db.chats.update(chatId, {
            notes: value,
            updatedAt: new Date(),
          });
          console.log(`Notes saved for chat ${chatId}`);
        } catch (error) {
          console.error("Error saving notes:", error);
        }
      }
    }, 1000)
  ).current;

  // Set up notes textarea event listener
  useEffect(() => {
    const textarea = notesTextareaRef.current;
    if (!textarea) return;

    const handleNotesChange = () => {
      const value = textarea.value;
      debouncedSaveNotes(value);
    };

    // Add event listener for both input and blur events
    textarea.addEventListener("input", handleNotesChange);
    textarea.addEventListener("blur", handleNotesChange); // Also save on blur

    return () => {
      textarea.removeEventListener("input", handleNotesChange);
      textarea.removeEventListener("blur", handleNotesChange);
    };
  }, [chatId, debouncedSaveNotes]);

  // Function to delete all IndexedDB data
  const deleteAllData = async () => {
    if (
      confirm(
        "Are you sure you want to delete ALL data? This cannot be undone."
      )
    ) {
      try {
        await db.chats.clear();
        await db.messages.clear();
        await db.keyvals.clear();
        localStorage.removeItem("syncStatus");
        localStorage.removeItem("syncError");
        toast.success("All data has been deleted");
        window.location.href = "/";
      } catch (error) {
        toast.error(`Failed to delete data: ${error}`);
      }
    }
  };

  // Function to manually trigger sync
  const handleManualSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      toast.loading("Syncing data...");
      const result = await syncAllData();
      toast.dismiss();
      toast.success(
        `Sync completed! Updated ${
          result.fetchedChats + result.receivedServerChanges
        } chats.`
      );
    } catch (error) {
      toast.dismiss();
      toast.error(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Function to toggle isPublic status
  const toggleShareStatus = async () => {
    if (!chat) return;

    try {
      const newIsPublic = chat.isPublic ? 0 : 1;

      // Update local database
      await db.chats.update(chat.id, {
        isPublic: newIsPublic,
        updatedAt: new Date(),
      });

      // The server will get the updated value during the next sync
      // Force sync to update immediately on the server
      try {
        syncAllData();
      } catch (syncError) {
        console.error(
          "Failed to sync after updating sharing status:",
          syncError
        );
        // Continue even if sync fails, as we've updated locally
      }

      toast.success(newIsPublic ? "Chat is now public" : "Chat is now private");

      // Copy share link if making public
      if (newIsPublic) {
        const shareUrl = `${window.location.origin}/share?id=${chat.id}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Share link copied to clipboard!");
      }
    } catch (error) {
      toast.error("Failed to update sharing status");
      console.error(error);
    }
  };

  // Calculate message count for current chat
  const messageCount =
    useLiveQuery(() => db.messages.where("chatId").equals(chatId).count()) || 0;

  const openNotesSidebarAndFocusTags = () => {
    focusModeRef.current = "tags";
    setShowNotesSidebar(true);
  };

  // Add tag to chat
  const addTag = async () => {
    if (!chatId || !tagInput.trim()) return;
    const newTag = tagInput.trim();
    const existingTags = chat?.tags || [];
    if (existingTags.includes(newTag)) return;
    await db.chats.update(chatId, {
      tags: [...existingTags, newTag],
      updatedAt: new Date(),
    });
    setTagInput("");
  };

  // Remove tag from chat
  const removeTag = async (tagToRemove: string) => {
    if (!chatId) return;
    const newTags = (chat?.tags || []).filter((t) => t !== tagToRemove);
    await db.chats.update(chatId, {
      tags: newTags,
      updatedAt: new Date(),
    });
  };

  return chat ? (
    <>
      {/* Command Menu */}
      {/* <CommandMenu
        open={cmdkOpen}
        onOpenChange={setCmdkOpen}
        chatId={chatId}
        showNotesSidebar={showNotesSidebar}
        setShowNotesSidebar={setShowNotesSidebar}
      /> */}

      {/* Notes Sidebar */}
      {showNotesSidebar && (
        <div className="fixed top-0 right-0 bottom-0 h-auto w-80 bg-zinc-900/95 border-l border-zinc-800 z-[9999] sidebar flex flex-col shadow-xl transition-all duration-300 ease-in-out">
          <div className="flex justify-between items-center p-3 border-b border-zinc-800">
            <div>
              <h3 className="text-zinc-300">Notes</h3>
              <div className="text-xs text-zinc-500 mt-1">
                Press <kbd className="px-1 py-0.5 text-xs lowercase">Esc</kbd>{" "}
                or{" "}
                <kbd className="px-1 py-0.5 text-xs lowercase">
                  {navigator.platform.includes("Mac") ? "⌥+N" : "Alt+N"}
                </kbd>{" "}
                to close
              </div>
            </div>
            <button
              onClick={() => {
                // Ensure notes are saved before closing
                if (notesTextareaRef.current) {
                  const value = notesTextareaRef.current.value;
                  // Force an immediate save instead of debounced
                  if (chatId && value !== chat?.notes) {
                    db.chats.update(chatId, {
                      notes: value,
                      updatedAt: new Date(),
                    });
                  }
                }
                setShowNotesSidebar(false);
              }}
              className="text-zinc-500 hover:text-zinc-300"
              title="Close Notes"
              aria-label="Close notes"
            >
              <XCircle size={20} />
            </button>
          </div>
          <div className="flex-grow flex flex-col h-full pb-8">
            {/* Tags Section */}
            <div className="p-3 border-b border-zinc-700 bg-zinc-800/30">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-zinc-300 text-sm">Tags</h4>
                <Tag size={14} className="text-zinc-400" />
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {chat.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="bg-zinc-600/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTag(tag);
                      }}
                      className="text-white/70 hover:text-white"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                {chat.tags?.length === 0 && (
                  <span className="text-zinc-500 text-xs italic">
                    No tags yet
                  </span>
                )}
              </div>
              <div className="flex">
                <input
                  ref={tagsInputRef}
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="flex-grow bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-l text-zinc-200 text-xs"
                  placeholder="Add a tag..."
                />
                <button
                  onClick={addTag}
                  className="bg-zinc-600/80 hover:bg-zinc-600 text-white px-2 py-1 rounded-r text-xs"
                >
                  Add
                </button>
              </div>
            </div>
            {/* Notes Section */}
            <textarea
              ref={notesTextareaRef}
              className="w-full h-full flex-grow !bg-zinc-900 border-0 resize-none p-4 shadow-inner"
              defaultValue={chat?.notes || ""}
              key={`notes-${chat.id}`} // Force re-render when chat changes
              placeholder="Write your notes here as you chat..."
            />
          </div>
        </div>
      )}

      {/* Debug Panel in Development Mode */}
      {isDevelopment && showDebugInfo && (
        <div className="fixed top-0 right-0 bg-zinc-900 border border-zinc-700 p-3 m-3 rounded shadow-lg z-50 text-zinc-300 font-mono text-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">DEBUG MODE</h3>
            <button
              onClick={() => setShowDebugInfo(false)}
              className="text-zinc-500 hover:text-zinc-300"
              title="Close Debug Panel"
              aria-label="Close debug panel"
            >
              <XCircle size={20} />
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <p>Database Stats:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>Chats: {allChatsCount ?? 0}</li>
                <li>Messages: {messagesCount ?? 0}</li>
                <li>Sync Status: {syncStatus}</li>
                {syncError && (
                  <li className="text-red-500">Error: {syncError}</li>
                )}
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className={`w-full bg-blue-900 hover:bg-blue-800 text-white py-2 px-4 rounded flex items-center justify-center ${
                  isSyncing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <RefreshCw
                  size={20}
                  className={`mr-2 ${isSyncing ? "animate-spin" : ""}`}
                />
                {isSyncing ? "Syncing..." : "Force Sync"}
              </button>

              <button
                onClick={deleteAllData}
                className="w-full bg-red-900 hover:bg-red-800 text-white py-2 px-4 rounded flex items-center justify-center"
              >
                <Trash2 size={20} className="mr-2" /> Delete All Data
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="!bg-zinc-900/50 fixed w-screen bottom-0 left-0 font-mono text-[13px] text-zinc-500 flex px-2 py-1 items-center justify-between translucent">
        {/* Left side: Only title and message count */}
        <div className="flex items-center space-x-2">
          {chatId !== "" ? (
            <>
              <span className="uppercase">
                {chat.title.substring(0, 40) +
                  (chat.title.length > 40 ? "..." : "")}
              </span>
              <Separator />
              <span className="uppercase" title="Message count">
                {messageCount} {messageCount === 1 ? "Message" : "Messages"}
              </span>
              {/* Display tags inline */}
              {chat.tags?.length > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center gap-1">
                    {chat.tags.slice(0, 3).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="text-blue-400 text-[11px] cursor-pointer hover:underline bg-transparent border-0 p-0 m-0 focus:outline-none"
                        onClick={openNotesSidebarAndFocusTags}
                        tabIndex={0}
                        aria-label={`Edit tag: #${tag}`}
                      >
                        #{tag}
                      </button>
                    ))}
                    {chat.tags.length > 3 && (
                      <button
                        type="button"
                        className="text-zinc-400 text-[11px] cursor-pointer hover:underline bg-transparent border-0 p-0 m-0 focus:outline-none"
                        onClick={openNotesSidebarAndFocusTags}
                        tabIndex={0}
                        aria-label="Show all tags"
                      >
                        +{chat.tags.length - 3}
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <span className="uppercase">{allChatsCount} Chats</span>
          )}
        </div>

        {/* Right side: Everything else */}
        <div className="uppercase flex items-center space-x-3">
          {/* Command menu button */}
          <button
            onClick={() => setCmdkOpen(true)}
            title="Command Menu (Cmd+K / Ctrl+K)"
            aria-label="Open command menu"
            className="text-zinc-400 hover:text-zinc-300"
          >
            <CommandIcon size={24} />
            <span className="ml-1 font-mono text-xs uppercase">
              <kbd>{navigator.userAgent.includes("Mac") ? "⌘" : "ctrl"}</kbd>+
              <kbd>k</kbd>
            </span>
          </button>

          <Separator />

          {isDevelopment && (
            <>
              <button
                onClick={() => setShowDebugInfo(!showDebugInfo)}
                title="Show/Hide Debug Panel"
                aria-label="Toggle debug panel"
                className="text-amber-500 hover:text-amber-400"
              >
                <Database size={24} />
              </button>

              <Separator />
            </>
          )}

          {chatId !== "" && (
            <>
              {/* Creation date */}
              <span className="uppercase" title="Creation date">
                {new Date(chat.createdAt).toLocaleDateString()}
              </span>
              <Separator />

              {/* Share2 (Public Sharing) Button */}
              <button
                type="button"
                title={
                  chat.isPublic
                    ? "Make Private / Unshare"
                    : "Make Public & Copy Share Link"
                }
                aria-label={
                  chat.isPublic
                    ? "Make chat private"
                    : "Make chat public and copy share link"
                }
                onClick={toggleShareStatus}
                className={`$${
                  chat.isPublic
                    ? "text-green-400 hover:text-green-300"
                    : "text-zinc-400 hover:text-blue-400"
                }`}
              >
                <Share2
                  size={28}
                  className={`inline-block align-middle transition-colors duration-150 ${
                    chat.isPublic
                      ? "text-green-400 hover:text-green-300"
                      : "text-zinc-400 hover:text-blue-400"
                  }`}
                />
              </button>
              <Separator />

              {/* Tag Button */}
              <button
                type="button"
                title={`${showNotesSidebar ? "Close" : "Show"} Tags (Alt+T)`}
                aria-label={`${showNotesSidebar ? "Close" : "Show"} tags`}
                onClick={() => {
                  if (!showNotesSidebar) {
                    openNotesSidebarAndFocusTags();
                  } else {
                    setShowNotesSidebar(false);
                  }
                }}
              >
                <Tag
                  size={28}
                  className={`inline-block hover:text-blue-400 hover:bg-zinc-800 ${
                    chat?.tags?.length > 0
                      ? "text-blue-400 hover:!text-blue-400"
                      : ""
                  } ${
                    showNotesSidebar ? "text-blue-400 hover:!text-blue-400" : ""
                  }`}
                />
              </button>

              {/* Notes Button for sidebar toggle - now includes tags management */}
              <button
                type="button"
                title={`${showNotesSidebar ? "Close" : "Show"} Notes (Alt+N)`}
                aria-label={`${showNotesSidebar ? "Close" : "Show"} notes`}
                onClick={() => {
                  if (!showNotesSidebar) {
                    focusModeRef.current = "tags";
                    setShowNotesSidebar(true);
                  } else {
                    // Ensure notes are saved before closing
                    if (notesTextareaRef.current) {
                      const value = notesTextareaRef.current.value;
                      if (chatId && value !== chat?.notes) {
                        db.chats.update(chatId, {
                          notes: value,
                          updatedAt: new Date(),
                        });
                      }
                    }
                    setShowNotesSidebar(false);
                  }
                }}
              >
                <FileText
                  size={28}
                  className={`inline-block hover:text-zinc-300 hover:bg-zinc-800 ${
                    chat?.notes ? "text-amber-600 hover:!text-amber-600" : ""
                  } ${
                    showNotesSidebar
                      ? "text-amber-600 hover:!text-amber-600"
                      : ""
                  }`}
                />
              </button>

              {/* Delete Button */}
              <button title="Delete Chat" aria-label="Delete chat">
                <Trash2
                  size={30}
                  className="inline-block hover:text-red-500 hover:bg-zinc-800"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this chat?")) {
                      db.chats.update(chat.id, {
                        inTrash: 1,
                        updatedAt: new Date(),
                      });
                      toast.success("Moved to trash");
                      window.location.href = "/?id=" + chat.id;
                    }
                  }}
                />
              </button>
            </>
          )}

          {/* Sync Status - rightmost */}
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`flex items-center ${
              syncStatus === "SYNCED"
                ? "text-green-500"
                : syncStatus === "ERROR"
                ? "text-red-500"
                : "text-yellow-500"
            } ${isSyncing ? "opacity-50" : "hover:text-opacity-80"}`}
            title={syncError ? `Sync Error: ${syncError}` : syncStatus}
          >
            {syncStatus === "SYNCED" ? (
              <Wifi size={30} className="mr-1 -mb-1" />
            ) : syncStatus === "ERROR" ? (
              <AlertCircle size={30} className="mr-1 -mb-1" />
            ) : (
              <RefreshCw
                size={30}
                className={`mr-1 -mb-1 ${isSyncing ? "animate-spin" : ""}`}
              />
            )}
            {syncStatus}
          </button>
        </div>
      </div>

      {/* Command Menu (CMD+K) */}
      <CommandMenu
        open={cmdkOpen}
        onOpenChange={setCmdkOpen}
        chatId={chatId || null}
        showNotesSidebar={showNotesSidebar}
        setShowNotesSidebar={setShowNotesSidebar}
      />
    </>
  ) : (
    <div></div>
  );
}

export default StatusBar;
