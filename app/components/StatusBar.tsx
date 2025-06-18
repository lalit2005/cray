// Date formatting handled with built-in Date methods
import {
  ArchiveRestore,
  MessageSquare,
  FileText,
  Pin,
  Trash2,
  Wifi,
  Database,
  XCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { db } from "~/localdb";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/Popover";
import toast from "react-hot-toast";
import { useSearchParams } from "@remix-run/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import debounce from "lodash/debounce";
import { syncAllData } from "~/lib/sync";

function Separator() {
  return <span className="mx-2"> &bull; </span>;
}

function StatusBar() {
  const [searchParams] = useSearchParams();
  const chatId = searchParams.get("id") || "";
  const allChatsCount = useLiveQuery(() => db.chats.count());
  const messagesCount = useLiveQuery(() => db.messages.count());
  const chat = useLiveQuery(
    () => db.chats.where("id").equals(chatId).first(),
    [chatId]
  );
  const [notes, setNotes] = useState("");
  const [syncStatus, setSyncStatus] = useState<"SYNCING" | "SYNCED" | "ERROR">(
    "SYNCED"
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Determine if we're in development mode
  const isDevelopment =
    process.env.NODE_ENV === "development" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // Update notes from chat data
  useEffect(() => {
    if (chat?.notes) {
      setNotes(chat.notes);
    } else {
      setNotes("");
    }
  }, [chat?.notes]);

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

  // Debounced function to save notes
  const debouncedSaveNotes = debounce((value: string) => {
    if (chatId && chat) {
      db.chats
        .update(chatId, {
          notes: value,
          updatedAt: new Date(),
        })
        .then(() => {
          toast.success("Notes saved", { duration: 1000 });
        });
    }
  }, 800);

  // Handle notes change
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);
    debouncedSaveNotes(value);
  };

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

  // Calculate message count for current chat
  const messageCount =
    useLiveQuery(() => db.messages.where("chatId").equals(chatId).count()) || 0;

  return chat ? (
    <>
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

      <div className="fixed w-screen bottom-0 left-0 font-mono text-[13px] text-zinc-500 flex px-2 py-1 items-center justify-between bg-zinc-900/50 translucent">
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
            </>
          ) : (
            <span className="uppercase">{allChatsCount} Chats</span>
          )}
        </div>

        {/* Right side: Everything else */}
        <div className="uppercase flex items-center space-x-3">
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

              {/* Pin/Bookmark Button */}
              <button
                title="Pin/Bookmark Chat"
                aria-label="Pin or bookmark chat"
              >
                <Pin
                  size={30}
                  className={`inline-block hover:text-zinc-300 hover:bg-zinc-800 ${
                    chat.isPinned ? "text-amber-600 hover:!text-amber-600" : ""
                  }`}
                  onClick={() => {
                    db.chats
                      .update(chat.id, {
                        isPinned: chat.isPinned ? 0 : 1,
                        updatedAt: new Date(),
                      })
                      .then(() => {
                        toast.success(chat.isPinned ? "Unpinned" : "Pinned");
                      });
                  }}
                />
              </button>

              {/* Archive Button */}
              <button title="Archive Chat" aria-label="Archive chat">
                <ArchiveRestore
                  size={30}
                  className={`inline-block -mb-1 hover:text-zinc-300 hover:bg-zinc-800 ${
                    chat.inTrash ? "text-amber-600 hover:!text-amber-600" : ""
                  }`}
                  onClick={() => {
                    db.chats
                      .update(chat.id, {
                        inTrash: chat.inTrash ? 0 : 1,
                        updatedAt: new Date(),
                      })
                      .then(() => {
                        toast.success(chat.inTrash ? "Restored" : "Archived");
                      });
                  }}
                />
              </button>

              {/* Notes Button with fixed Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Chat Notes"
                    aria-label="Edit chat notes"
                  >
                    <FileText
                      size={30}
                      className={`inline-block hover:text-zinc-300 hover:bg-zinc-800 ${
                        notes ? "text-amber-600 hover:!text-amber-600" : ""
                      }`}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent sideOffset={10} align="end">
                  <div className="space-y-2">
                    <h3 className="font-medium text-zinc-300">Notes</h3>
                    <textarea
                      className="w-full h-32 p-2 bg-zinc-800 border border-zinc-700 rounded resize-none text-zinc-300"
                      value={notes}
                      onChange={handleNotesChange}
                      placeholder="Write your notes here..."
                    />
                  </div>
                </PopoverContent>
              </Popover>

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

              <Separator />
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
    </>
  ) : (
    <div></div>
  );
}

export default StatusBar;
