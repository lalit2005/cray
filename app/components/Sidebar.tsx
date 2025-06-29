import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@remix-run/react";
import { Button } from "./ui/Button";
import { db, Chats } from "~/localdb";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import {
  CircleAlert,
  KeyIcon,
  UserIcon,
  Database as DatabaseIcon,
  LogOut as LogOutIcon,
  GithubIcon,
  PinIcon,
  MessageSquare,
} from "lucide-react";
import { Dialog, DialogContent } from "./ui/Dialog";
import { getApiKeys, setApiKey } from "~/lib/apiKeys";
import { Providers, SUPPORTED_MODELS } from "~/lib/models";
import { useAuth } from "~/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/Dropdown";

const ApiKeysDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState(getApiKeys());

  const handleSave = () => {
    Object.entries(apiKeys).forEach(([provider, key]) => {
      setApiKey(provider as Providers, key);
    });
    setIsOpen(false);
  };

  return (
    <>
      <Button className="w-full py-2" onClick={() => setIsOpen(true)}>
        <KeyIcon className="mr-1" />
        API keys
        {Object.values(apiKeys).every((key) => !key) && (
          <span className="text-xs text-red-300 p-1 rounded bg-red-800/50 uppercase ml-2">
            <CircleAlert className="mr-1" />
            no keys set
          </span>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          title="Manage API Keys"
          description="These keys will never be stored on the server"
        >
          <div className="space-y-4">
            {Object.keys(SUPPORTED_MODELS).map((provider) => (
              <div key={provider} className="space-y-1">
                <label className="block text-sm font-medium capitalize mb-1 text-zinc-600">
                  {provider} API Key
                </label>
                <input
                  type="password"
                  value={apiKeys[provider as Providers] || ""}
                  onChange={(e) =>
                    setApiKeys({
                      ...apiKeys,
                      [provider as Providers]: e.target.value,
                    })
                  }
                  placeholder={`Enter ${provider} API key`}
                />
              </div>
            ))}
          </div>
          <div className="mt-5 space-x-3">
            <Button onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const Sidebar = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleNewChat = useCallback(() => {
    navigate("/?new");
  }, [navigate]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target as HTMLElement)?.isContentEditable
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", handleKeydown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [inputRef, handleNewChat]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const focusedItem = document.activeElement;
      if (!focusedItem?.closest("li")) return;

      const listItems = Array.from(document.querySelectorAll(".sidebar li"));
      const currentIndex = listItems.indexOf(focusedItem.closest("li")!);

      if (e.key === "ArrowDown" && currentIndex < listItems.length - 1) {
        e.preventDefault();
        (
          listItems[currentIndex + 1].querySelector("a") as HTMLElement
        )?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (currentIndex === 0) {
          // If on the first item, focus the search input
          inputRef.current?.focus();
        } else if (currentIndex > 0) {
          // Otherwise move to the previous item
          (
            listItems[currentIndex - 1].querySelector("a") as HTMLElement
          )?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [inputRef]);

  const chats = useLiveQuery(() =>
    db.chats
      .where("inTrash")
      .equals(0)
      .reverse()
      .toArray()
      .then((chats) => {
        return chats.sort((a, b) => {
          // pinned chats first
          // order by updated at
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
      })
  );

  const [results, setResults] = useState<Chats[]>(chats || []);
  useEffect(() => {
    setResults(chats || []);
  }, [chats]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.addEventListener("input", () => {
        const query = inputRef.current?.value.toLowerCase() || "";
        const filteredResults = chats?.filter((chat) =>
          chat.title.toLowerCase().includes(query)
        );
        setResults(filteredResults || []);
      });
    }
  }, [chats]);

  // Group chats by date category
  function getDateCategory(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const chatDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const diffMs = today.getTime() - chatDay.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";

    // Get start of this week (Monday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
    if (chatDay >= startOfWeek && diffDays < 7) return "This week";

    // Get start of last week
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setDate(startOfWeek.getDate() - 1);
    if (chatDay >= startOfLastWeek && chatDay <= endOfLastWeek)
      return "Last week";

    if (
      today.getFullYear() === chatDay.getFullYear() &&
      today.getMonth() === chatDay.getMonth()
    ) {
      return "Earlier this month";
    }
    return "Older";
  }

  function groupChatsByDate(chats: Chats[]) {
    // Separate pinned and unpinned
    const pinned: Chats[] = [];
    const unpinned: Chats[] = [];
    chats.forEach((chat) => {
      if (chat.isPinned) {
        pinned.push(chat);
      } else {
        unpinned.push(chat);
      }
    });

    // Group unpinned by date
    const groups: { [key: string]: Chats[] } = {};
    unpinned.forEach((chat) => {
      const cat = getDateCategory(chat.updatedAt.toString());
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(chat);
    });
    // Sort groups by recency
    const order = [
      "Today",
      "Yesterday",
      "This week",
      "Last week",
      "Earlier this month",
      "Older",
    ];
    const result = [];
    if (pinned.length > 0) {
      result.push({
        title: "Pinned",
        chats: pinned.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
      });
    }
    result.push(
      ...order
        .filter((cat) => groups[cat]?.length)
        .map((cat) => ({
          title: cat,
          chats: groups[cat].sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          ),
        }))
    );
    return result;
  }
  return (
    <div className="px-4 py-2 relative h-screen sidebar">
      <h1 className="text inline-block mt-3">
        C R A Y
        <span className="text text-zinc-600 ml-1 relative top-px">v0.1.0</span>
      </h1>

      <div className="mt-6 mb-2" id="chats-list-container">
        <div className="flex items-center justify-center">
          <input
            type="text"
            ref={inputRef}
            placeholder="Search chats"
            className="px-4 py-1 w-full rounded-r-none ring ring-zinc-800"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                // Get the first group
                const firstChatGroup = document.querySelector(
                  ".sidebar ul.space-y-1"
                );
                if (firstChatGroup) {
                  // Find the first link in the first group
                  const firstChat = firstChatGroup.querySelector(
                    "li a"
                  ) as HTMLElement;
                  if (firstChat) {
                    // Focus it and stop propagation
                    setTimeout(() => firstChat.focus(), 0);
                  }
                }
              }
            }}
          />
          <div className="bg-zinc-800 px-2 py-1 rounded-r-md ring ring-zinc-800">
            <span className="text-zinc-400">/</span>
          </div>
        </div>
        <div className="mt-4 h-[calc(100vh-350px)] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent hover:scrollbar-thumb-zinc-600 transition-colors duration-200 scroll-smooth overscroll-contain">
          {results?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="bg-zinc-800/50 p-6 rounded-full mb-4">
                <MessageSquare className="w-10 h-10 text-zinc-500" />
              </div>
              <h3 className="text-lg font-medium text-zinc-200 mb-1">
                No chats yet
              </h3>
              <p className="text-sm text-zinc-400 max-w-md">
                Start a new conversation to see it appear here
              </p>
            </div>
          ) : (
            <div>
              {groupChatsByDate(results).map((group) => (
                <div key={group.title} className="mb-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold px-2 mb-1 mt-3">
                    {group.title}
                  </div>
                  <ul className="space-y-1">
                    {group.chats.map((chat) => {
                      const isActive =
                        typeof window !== "undefined" &&
                        window.location.search.includes(`id=${chat.id}`);
                      return (
                        <li key={chat.id} tabIndex={-1}>
                          <Link
                            to={`/?id=${chat.id}`}
                            tabIndex={0}
                            className={clsx(
                              "px-3 py-1 focus:outline-none rounded-md rounded-l-none relative flex items-center gap-2",
                              isActive
                                ? "border-l-4 border-l-amber-500 bg-zinc-800 shadow-inner shadow-amber-900/10"
                                : "focus:bg-zinc-800 border-l-amber-500 hover:bg-zinc-900 text-zinc-300"
                            )}
                          >
                            <p className="text-sm font-medium truncate w-full">
                              {chat.title +
                                (import.meta.env.DEV
                                  ? " - " + chat.id.slice(0, 5)
                                  : "")}
                              <span className="absolute right-2 top-1/2 -translate-y-1/2">
                                {chat.isPinned ? (
                                  <PinIcon className="w-4 h-4 text-amber-500" />
                                ) : null}
                              </span>
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-16 left-0 right-0 w-full px-4 space-y-2">
        <div className="flex flex-col gap-2">
          <Button className="w-full py-2" onClick={handleNewChat}>
            New Chat
            <span className="font-mono text-xs uppercase ml-1">
              <kbd>{navigator.userAgent.includes("Mac") ? "⌘" : "ctrl"}</kbd>+
              <kbd>i</kbd>
            </span>
          </Button>
        </div>
        <ApiKeysDialog />
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <div className="block w-full px-2 py-1  hover:bg-zinc-900 text-left rounded-md border border-zinc-800 focus:outline-none focus:ring-0">
              <div className="flex items-center justify-start">
                <UserIcon className="rounded p-1 !h-8 !w-8 -mb-1" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">
                    Signed in as {user?.name}
                  </span>
                  {user?.email && (
                    <span className="text-xs text-zinc-400">{user?.email}</span>
                  )}
                </div>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <div className="flex items-end -mb-1 gap-2">
                <UserIcon className="w-4 h-4" />
                <span>{user?.name}</span>
                <span className="text-xs text-zinc-400">{user?.email}</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                window.open(
                  "https://github.com/lalit2005/cray/issues/new",
                  "_blank"
                )
              }
            >
              <div className="flex items-end -mb-1 gap-2">
                <DatabaseIcon className="w-4 h-4" />
                <span>Feedback</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                window.open("https://github.com/lalit2005/cray", "_blank")
              }
            >
              <div className="flex items-end -mb-1 gap-2">
                <GithubIcon className="w-4 h-4" />
                <span>GitHub</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <div className="flex items-end -mb-1 gap-2 text-red-400">
                <LogOutIcon className="w-4 h-4" />
                <span>Logout</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
