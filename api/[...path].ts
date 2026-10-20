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
  // vercel.json rewrites every /api/* request to this function and preserves
  // the original path in __route. Restore it before Express route matching.
  const parsed = new URL(req.url ?? "/", "http://vercel.internal");
  const routedPath = parsed.searchParams.get("__route");

  if (
    routedPath &&
    !routedPath.startsWith("/") &&
    !routedPath.includes("..") &&
    /^[A-Za-z0-9_./:-]+$/.test(routedPath)
  ) {
    parsed.searchParams.delete("__route");
    const query = parsed.searchParams.toString();
    req.url = `/api/${routedPath}${query ? `?${query}` : ""}`;
  } else {
    // Local development and direct invocation fallback.
    const url = req.url ?? "/";
    if (!url.startsWith("/api/") && url !== "/api") {
      req.url = `/api${url.startsWith("/") ? "" : "/"}${url}`;
    }
  }

  return app(req, res);
}
