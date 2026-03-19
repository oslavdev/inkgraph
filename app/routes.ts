import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("projects", "routes/projects.tsx"),
  route("editor", "routes/editor.tsx", [
    route(":projectId", "routes/editor.tsx", { id: "editor-project" }),
  ]),
  route("login", "routes/login.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("account", "routes/account.tsx"),
  route("simulator", "routes/simulator.tsx"),
  route("api/auth/*", "routes/api.auth.$.ts"),
] satisfies RouteConfig