import { createApp } from "../services/platform/src/app.ts";

const vercelEnvironment = process.env.VERCEL_ENV;
const environment =
  vercelEnvironment === "production"
    ? "production"
    : vercelEnvironment === "preview"
      ? "preview"
      : (process.env.NODE_ENV ?? "development");

const { app } = createApp({ environment });

type HandlerRequest = Parameters<typeof app>[0];
type HandlerResponse = Parameters<typeof app>[1];

export default function handler(req: HandlerRequest, res: HandlerResponse) {
  // Vercel catch-all functions may receive a path relative to /api. The
  // platform router registers canonical /api/... paths, so normalize once.
  const url = req.url ?? "/";
  if (!url.startsWith("/api/") && url !== "/api") {
    req.url = `/api${url.startsWith("/") ? "" : "/"}${url}`;
  }
  return app(req, res);
}
