import {
  FileText as NotesIcon,
  Wifi,
  RefreshCw,
  AlertCircle,
  Pin,
  Trash2,
  Command as CommandIcon,
} from "lucide-react";
import { db } from "~/localdb";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { syncAllData } from "~/lib/sync";
import { Dialog, DialogContent, DialogTrigger } from "./ui/Dialog";
import toast from "react-hot-toast";
import { useNavigate } from "@remix-run/react";
import { CommandMenu } from "./CommandMenu";

function Separator() {
  return <span className="mx-2"> &bull; </span>;
}

export default function HomepageStatusBar() {
  const navigate = useNavigate();
  const [cmdkOpen, setCmdkOpen] = useState(false); // Command menu state
  const [showTrashedDialog, setShowTrashedDialog] = useState(false);
  const allChatsCount = useLiveQuery(() => db.chats.count()) || 0;
  const pinnedChatsCount =
    useLiveQuery(() => db.chats.where("isPinned").equals(1).count()) || 0;
  const trashedChatsCount =
    useLiveQuery(() => db.chats.where("inTrash").equals(1).count()) || 0;
  const chatsWithNotes =
    useLiveQuery(() => db.chats.where("notes").notEqual("").toArray()) || [];
  const trashedChats =
    useLiveQuery(() => db.chats.where("inTrash").equals(1).toArray()) || [];

  // Sync status state
  const [syncStatus, setSyncStatus] = useState<"SYNCING" | "SYNCED" | "ERROR">(
    "SYNCED"
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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

  // Add keyboard shortcut for Command+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Support Command+K / Ctrl+K to toggle command menu
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdkOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  return (
    <div className="fixed w-screen bottom-0 left-0 z-[9999] font-mono text-[13px] text-zinc-500 flex px-2 py-1 items-center justify-between bg-zinc-900/50">
      {/* Left side: Stats about chats */}
      <div className="flex items-center space-x-2">
        <span className="uppercase">{allChatsCount} Chats</span>

        {pinnedChatsCount > 0 && (
          <>
            <Separator />
            <span className="uppercase text-amber-500/70" title="Pinned chats">
              <Pin size={16} className="inline mr-1" />
              {pinnedChatsCount} Pinned
            </span>
          </>
        )}
        {trashedChatsCount > 0 && (
          <>
            <Separator />
            <button
              className="uppercase text-red-500 flex items-center hover:text-zinc-300"
              title="Trashed chats"
              onClick={() => setShowTrashedDialog(true)}
            >
              <Trash2 size={16} className="inline mr-1" />
              {trashedChatsCount} Trashed
            </button>
          </>
        )}
      </div>

      {/* Right side: Command Menu, Notes button and Sync status */}
      <div className="flex items-center space-x-4">
        {/* Command Menu Button */}
        <button
          onClick={() => setCmdkOpen(true)}
          title="Command Menu (Cmd+K / Ctrl+K)"
          aria-label="Open command menu"
          className="flex items-center hover:text-zinc-300 uppercase"
        >
          <CommandIcon size={16} className="mr-1 -mb-1" />
          <span className="ml-1 font-mono text-xs">
            <kbd>{navigator.userAgent.includes("Mac") ? "⌘" : "ctrl"}</kbd>+
            <kbd>k</kbd>
          </span>
        </button>

        <Separator />

        {/* Notes Button */}
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="flex items-center hover:text-zinc-300"
              title="View all notes"
            >
              <NotesIcon size={14} className="mr-1 -mb-1" />
              <span>NOTES</span>
              <span className="ml-1 text-zinc-400">
                ({chatsWithNotes.length})
              </span>
            </button>
          </DialogTrigger>
          <DialogContent
            title="All Chat Notes"
            description="Click on a note to go to that chat"
          >
            <div className="max-h-[400px] overflow-y-auto">
              {chatsWithNotes.length > 0 ? (
                chatsWithNotes.map((chat) => (
                  <div
                    key={chat.id}
                    className="bg-zinc-950 px-3 py-1.5 rounded cursor-pointer hover:bg-zinc-900 transition-colors"
                    onClick={() => {
                      navigate(`/?id=${chat.id}`);
                      // Close the dialog after navigation
                      document.body.click();
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        navigate(`/?id=${chat.id}`);
                      }
                    }}
                  >
                    <h3 className="text-zinc-300 font-medium mb-1 truncate text-sm">
                      {chat.title}
                    </h3>
                    <p className="text-zinc-400 whitespace-pre-wrap line-clamp-3">
                      {chat.notes}
                    </p>
                    <div className="flex justify-between mt-2 text-xs text-zinc-500">
                      <span>
                        {new Date(chat.createdAt).toLocaleDateString()}
                      </span>
                      <span>Click to open</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-zinc-400">
                  <NotesIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No notes have been added to any chats</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

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
            <Wifi size={18} className="mr-1 -mb-1" />
          ) : syncStatus === "ERROR" ? (
            <AlertCircle size={18} className="mr-1 -mb-1" />
          ) : (
            <RefreshCw
              size={18}
              className={`-mb-1 mr-1 ${isSyncing ? "animate-spin" : ""}`}
            />
          )}
          {syncStatus}
        </button>
      </div>

      {/* Command Menu - global keyboard commands */}
      <CommandMenu
        open={cmdkOpen}
        onOpenChange={setCmdkOpen}
        chatId={null}
        showNotesSidebar={false}
        setShowNotesSidebar={() => {}}
      />

      {/* Trashed Chats Dialog */}
      <Dialog open={showTrashedDialog} onOpenChange={setShowTrashedDialog}>
        <DialogContent
          title="Trashed Chats"
          description="Click a chat to restore it from trash."
        >
          <div>
            {trashedChats.length > 0 ? (
              trashedChats.map((chat) => (
                <div
                  key={chat.id}
                  className="bg-zinc-950 px-3 py-1 rounded cursor-pointer hover:bg-zinc-900 transition-colors relative"
                  onClick={async () => {
                    await db.chats.update(chat.id, { inTrash: 0 });
                    toast.success(`Restored chat: ${chat.title}`);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      await db.chats.update(chat.id, { inTrash: 0 });
                      toast.success(`Restored chat: ${chat.title}`);
                    }
                  }}
                >
                  <div className="text-zinc-300 font-medium mb-1 truncate text-sm flex items-center justify-between">
                    {chat.title}
                    <div>
                      <span className="text-xs text-zinc-500">
                        {new Date(chat.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-zinc-400">
                <Trash2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No trashed chats</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
