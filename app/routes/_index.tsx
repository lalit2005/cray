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

import { useAuth } from "~/lib/auth";
import { useNavigate } from "@remix-run/react";

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (!loading && !user) {
    navigate("/login");
    return null;
  }
  if (loading) {
    return (
      <p className="text-zinc-500 animate-pulse absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        Loading...
      </p>
    );
  }
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
