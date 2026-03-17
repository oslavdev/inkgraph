import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from "react-router"
import type { Route } from "./+types/root"

export const meta: Route.MetaFunction = () => [
  { title: "Inkgraph — Visual Dialogue Editor for VNs & RPGs" },
  {
    name: "description",
    content:
      "A node-based visual dialogue editor for visual novels and RPGs. Build branching conversations, manage characters and variables — free, runs in your browser.",
  },
]

export function links(): Route.LinkDescriptors {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossOrigin: "anonymous",
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
    },
  ]
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { height: 100%; }
          body {
            background: #0a0a0a;
            color: #e5e5e5;
            font-family: 'Inter', system-ui, sans-serif;
            -webkit-font-smoothing: antialiased;
          }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: #111; }
          ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        `}</style>
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!"
  let details = "An unexpected error occurred."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error"
    details =
      error.status === 404
        ? "The page you're looking for doesn't exist."
        : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
        padding: 24,
        fontFamily: "monospace",
        color: "#555",
      }}
    >
      <div style={{ fontSize: 48, color: "#1e1e1e" }}>⚠</div>
      <h1 style={{ fontSize: 24, color: "#e5e5e5" }}>{message}</h1>
      <p style={{ fontSize: 14 }}>{details}</p>
      {stack && (
        <pre
          style={{
            fontSize: 11,
            color: "#333",
            maxWidth: 600,
            overflow: "auto",
            padding: 16,
            background: "#111",
            borderRadius: 6,
          }}
        >
          {stack}
        </pre>
      )}
    </div>
  )
}
