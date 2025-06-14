import { Link } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { Button } from "./ui/Button";
import { db } from "~/localdb";
import { useNavigate } from "@remix-run/react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";

export const Sidebar = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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

  const chats = useLiveQuery(() => db.chats.toArray());

  const handleNewChat = () => {
    navigate("/?new");
  };

  return (
    <div className="px-4 py-2 relative h-screen">
      <h1 className="text inline-block">
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
                    "overflow-hidden sm:rounded-xs px-2 py-1 my-3 ring ring-zinc-900 sm:border border-zinc-900 focus:outline-none block sm:bg-gradient-to-br from-zinc-900/20 to-zinc-900/70 hover:from-zinc-900/40 hover:to-zinc-900/80 focus:from-zinc-900/40 focus:to-zinc-900/80 focus:ring focus:ring-zinc-800 relative"
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

      <div className="absolute bottom-3 left-0 right-0 w-full text-center">
        <Button className="w-[90%] mx-auto" onClick={handleNewChat}>
          New chat
        </Button>
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
