import { intlFormatDistance } from "date-fns";
import { ArchiveRestore, Pin, Trash2 } from "lucide-react";
import { db } from "~/localdb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/Dropdown";
import toast from "react-hot-toast";
import { useSearchParams } from "@remix-run/react";
import { useLiveQuery } from "dexie-react-hooks";

function Separator() {
  return <> &bull; </>;
}

function StatusBar() {
  const [searchParams] = useSearchParams();
  const chatId = searchParams.get("id") || "";
  const allChatsCount = useLiveQuery(() => db.chats.count());
  const chat = useLiveQuery(
    () => db.chats.where("id").equals(chatId).first(),
    [chatId]
  );

  return chat ? (
    <div className="fixed w-screen bottom-0 left-0 font-mono text-[13px] text-zinc-500 flex px-2 items-center justify-between bg-zinc-900">
      <div className="max-w-[calc(100vw/2)]">
        {chatId !== "" ? (
          <>
            <span className="uppercase">
              {chat.title.substring(0, 50) +
                (chat.title.length > 50 ? "..." : "")}
            </span>
            <Separator />
            <span className="uppercase">
              {intlFormatDistance(chat.updatedAt, new Date(), {
                style: "narrow",
              })}{" "}
            </span>
          </>
        ) : (
          <span className="uppercase">{allChatsCount} Chats</span>
        )}
      </div>
      <div className="uppercase space-x-1">
        {chatId !== "" && (
          <button>
            <Pin
              size={21.5}
              className={`inline-block px-1 hover:text-zinc-300 p-0.5 hover:bg-zinc-800 ${
                chat.isPinned && "text-amber-600 hover:!text-amber-600"
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
        )}

        {chatId !== "" && (
          <button>
            <ArchiveRestore
              size={21.5}
              className={`inline-block px-1 hover:text-zinc-300 p-0.5 hover:bg-zinc-800 ${
                chat.inTrash && "text-amber-600 hover:!text-amber-600"
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
        )}
        {chatId !== "" && (
          <button>
            <Trash2
              size={21.5}
              className="inline-block px-1 hover:text-red-500 p-0.5 hover:bg-zinc-800"
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
        )}
        {chatId !== "" && (
          <button>
            <ArchiveRestore
              size={21.5}
              className={`inline-block px-1 hover:text-zinc-300 p-0.5 hover:bg-zinc-800`}
            />
          </button>
        )}

        {/* <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button>
              <ArchiveRestore
                size={22.5} // size=22.5 and -mt-0.5 for optical alignment
                className="inline-block -mt-0.5 px-1 hover:text-zinc-300 p-0.5 hover:bg-zinc-800"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="p-1 mb-2 text-sm">
              Archive Chat
            </DropdownMenuLabel>
            {chat.messages?.length === 0 && (
              <DropdownMenuItem>No messages in trash</DropdownMenuItem>
            )}
            {chat.messages.map((message) => (
              <DropdownMenuItem
                key={message.id}
                onClick={() => {
                  db.chats
                    .update(chat.id, {
                      messages: [
                        ...chat.messages.filter((m) => m.id !== message.id),
                        {
                          id: message.id,
                          content: message.content,
                          createdAt: message.createdAt,
                          provider: message.provider,
                          model: message.model,
                          inTrash: 0,
                        },
                      ],
                      updatedAt: new Date(),
                    })
                    .then(() => {
                      toast.success("Restored message", {});
                    });
                }}
              >
                {message.content.substring(0, 30) +
                  (message.content.length > 30 ? "..." : "")}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu> */}

        <button>
          <Trash2
            size={22}
            className="inline-block -mt-1 px-1 hover:text-red-500 p-0.5 hover:bg-zinc-800"
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

        {new Intl.DateTimeFormat("en-US", {
          day: "numeric",
          month: "2-digit",
          year: "2-digit",
        }).format(new Date(chat.updatedAt))}
      </div>
    </div>
  ) : (
    <div></div>
  );
}

export default StatusBar;
