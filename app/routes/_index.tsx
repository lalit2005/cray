import type { MetaFunction } from "@remix-run/node";
import { Sidebar } from "~/components/Sidebar";
import { ChatWindow } from "~/components/ChatWindow";
import { StatusBar } from "~/components/StatusBar";

export const meta: MetaFunction = () => {
  return [
    { title: "Cray" },
    // { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="grid grid-cols-12 w-screen">
        <div className="h-screen bg-zinc-900/50 min-h-screen relative min-w-64 left-0 top-0 col-span-2 overflow-scroll">
          <Sidebar />
        </div>
        <div className="col-span-10 h-screen min-h-screen overflow-scroll w-full">
          <ChatWindow />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
