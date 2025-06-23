import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";

import "./tailwind.css";
import { AuthProvider } from "./lib/auth";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  {
    rel: "preconnect",
    href: "https://rsms.me/",
  },
  {
    rel: "stylesheet",
    href: "https://rsms.me/inter/inter.css",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {process.env.NODE_ENV == "production" && (
          <script
            defer
            src="https://stats.lalit.sh/script.js"
            data-website-id="5c0a57ac-1b8c-4f22-bb36-ff80156623f8"
          ></script>
        )}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export function HydrateFallback() {
  return (
    <p className="text-zinc-500 animate-pulse absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      Loading...
    </p>
  );
}
