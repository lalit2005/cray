import { Link } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { Button } from "./ui/Button";
import { db } from "~/localdb";
import { useNavigate } from "@remix-run/react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { KeyIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
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
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          title="Manage API Keys"
          description="These keys will never be stored on the server"
        >
          <div className="space-y-4">
            {Object.keys(SUPPORTED_MODELS).map((provider) => (
              <div key={provider} className="space-y-1">
                <label
                  className="block text-sm font-medium capitalize"
                  hidden
                />
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

  const handleNewChat = () => {
    navigate("/?new");
  };

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
      } else if (e.ctrlKey && e.key === "i") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", handleKeydown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [inputRef]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const focusedItem = document.activeElement;
      if (!focusedItem?.closest("li")) return;

      const listItems = Array.from(document.querySelectorAll("li"));
      const currentIndex = listItems.indexOf(focusedItem.closest("li")!);

      if (e.key === "ArrowDown" && currentIndex < listItems.length - 1) {
        e.preventDefault();
        (
          listItems[currentIndex + 1].querySelector("a") as HTMLElement
        )?.focus();
      } else if (e.key === "ArrowUp" && currentIndex > 0) {
        e.preventDefault();
        (
          listItems[currentIndex - 1].querySelector("a") as HTMLElement
        )?.focus();
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  const chats = useLiveQuery(() =>
    db.chats.orderBy("createdAt").reverse().toArray()
  );

  return (
    <div className="px-4 py-2 relative h-screen sidebar">
      <h1 className="text inline-block mt-3">
        C R A Y
        <span className="text text-zinc-600 ml-1 relative top-px">v0.1.0</span>
      </h1>

      <div className="mt-6 mb-2">
        <div className="flex items-center justify-center">
          <input
            type="text"
            ref={inputRef}
            placeholder="Search chats"
            className="px-4 py-1 w-full rounded-r-none ring ring-zinc-800"
          />
          <div className="bg-zinc-800 px-2 py-1 rounded-r-md ring ring-zinc-800">
            <span className="text-zinc-400">/</span>
          </div>
        </div>
        <div className="mt-4">
          <ul>
            {chats?.map((chat, index) => (
              <li key={chat.id} tabIndex={-1}>
                <Link
                  to={`/?id=${chat.id}`}
                  tabIndex={0}
                  className={clsx(
                    "overflow-hidden px-2 py-1 my-3 ring ring-zinc-900 sm:border border-zinc-900 focus:outline-none block sm:bg-gradient-to-br from-zinc-900/20 to-zinc-900/70 hover:from-zinc-900/40 hover:to-zinc-900/80 focus:from-zinc-900/40 focus:to-zinc-900/80 focus:ring focus:ring-zinc-800 relative"
                  )}
                >
                  <p className="text-sm">
                    {chat.title + " - " + chat.id.slice(0, 5)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="absolute bottom-16 left-0 right-0 w-full px-4 space-y-2">
        <div className="flex flex-col gap-2">
          <Button className="w-full py-2" onClick={handleNewChat}>
            New Chat
            <span className="font-mono text-xs uppercase ml-1">
              <kbd>ctrl</kbd>+<kbd>i</kbd>
            </span>
          </Button>
        </div>
        <ApiKeysDialog />
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="px-2 py-1 hover:bg-zinc-800 w-full text-center mx-auto">
              Signed in as {user?.name}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// const exampleAIChatTitles = [
//   {
//     title: "Explanation of DHCP in detail",
//     id: "le32nam3",
//   },
//   {
//     title: "How to use Remix with TypeScript",
//     id: "a1b2c3d4",
//   },
//   {
//     title: "Best practices for React performance",
//     id: "x9y8z7w6",
//   },
//   {
//     title: "Understanding the Virtual DOM",
//     id: "v5u6t7s8",
//   },
//   {
//     title: "CSS Grid vs Flexbox",
//     id: "g1h2i3j4",
//   },
//   {
//     title: "JavaScript ES6 features",
//     id: "k5l6m7n8",
//   },
//   {
//     title: "Building REST APIs with Node.js",
//     id: "o9p0q1r2",
//   },
//   {
//     title: "Introduction to GraphQL",
//     id: "s3t4u5v6",
//   },
// ];
