import type { MetaFunction } from "@remix-run/node";
import { Sidebar } from "~/components/Sidebar";
import { ChatWindow } from "~/components/ChatWindow";
import StatusBar from "~/components/StatusBar";
import { Toaster } from "react-hot-toast";

export const meta: MetaFunction = () => {
  return [
    { title: "Cray" },
    // { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  return (
    <div className="flex flex-col h-screen">
      <div className="grid grid-cols-10 overflow-hidden">
        <aside className="col-span-2 bg-zinc-900/50 overflow-y-auto">
          <Sidebar />
        </aside>
        <main className="col-span-8 overflow-y-auto">
          <ChatWindow />
        </main>
      </div>
      <StatusBar />
      <Toaster />
    </div>
  );
}
