import type { MetaFunction } from "@remix-run/node";
import { Sidebar } from "~/components/Sidebar";
import { ChatWindow } from "~/components/ChatWindow";
import StatusBar from "~/components/StatusBar";
import HomepageStatusBar from "~/components/HomepageStatusBar";
import { Toaster } from "react-hot-toast";

import { useAuth } from "~/lib/auth";
import { useNavigate, useSearchParams } from "@remix-run/react";
import { useEffect } from "react";
import { syncAllData } from "~/lib/sync";

export const meta: MetaFunction = () => {
  return [
    { title: "Cray" },
    // { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    syncAllData();
  }, [searchParams]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncAllData();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
      <div className="relative">
        {searchParams.has("id") ? <StatusBar /> : <HomepageStatusBar />}
      </div>
      <Toaster
        toastOptions={{
          icon: <></>,
          className: "!bg-zinc-950 border-2 border-zinc-800 !text-zinc-300",
          error: {
            className: "!bg-red-950 border-2 border-red-900/50 !text-red-500",
          },
        }}
        containerClassName="mb-6"
      />
    </div>
  );
}
