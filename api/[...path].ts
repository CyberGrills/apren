import { createApp } from "../services/platform/src/app.ts";
import { createPool } from "../services/platform/src/db.ts";
import { paymentReadiness } from "../services/platform/src/providerRegistry.ts";
import { schemaIsReady } from "../services/platform/src/schemaReadiness.ts";

const vercelEnvironment = process.env.VERCEL_ENV;
const environment =
  vercelEnvironment === "production"
    ? "production"
    : vercelEnvironment === "preview"
      ? "preview"
      : (process.env.NODE_ENV ?? "development");

type HandlerRequest = Parameters<ReturnType<typeof createApp>["app"]>[0];
type HandlerResponse = Parameters<ReturnType<typeof createApp>["app"]>[1];

let app: ReturnType<typeof createApp>["app"] | undefined;

function restorePath(req: HandlerRequest): string {
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

  return new URL(req.url ?? "/", "http://vercel.internal").pathname;
}

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  const pathname = restorePath(req);

  // Liveness must not depend on database configuration or availability.
  if (req.method === "GET" && pathname === "/api/health/live") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ data: { status: "ok" } });
  }

  // Readiness checks the database but reports a controlled 503 rather than
  // letting missing credentials or TLS failures become Vercel function 500s.
  if (req.method === "GET" && pathname === "/api/health/ready") {
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      return res.status(503).json({
        error: { code: "DATABASE_NOT_CONFIGURED", message: "Database connection is not configured." },
      });
    }

    let pool: ReturnType<typeof createPool> | undefined;
    try {
      pool = createPool();
      if (!(await schemaIsReady(pool))) {
        return res.status(503).json({
          error: { code: "SCHEMA_NOT_READY", message: "Database schema migrations are incomplete." },
        });
      }
      const payments = paymentReadiness(environment);
      return res.status(200).json({
        data: { status: "ready", storage: "postgresql", paymentMode: payments.mode, payments },
      });
    } catch {
      return res.status(503).json({
        error: { code: "DATABASE_NOT_READY", message: "Database connection or schema is not ready." },
      });
    } finally {
      if (pool) await pool.end().catch(() => undefined);
    }
  }

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    return res.status(503).json({
      error: { code: "DATABASE_NOT_CONFIGURED", message: "Database connection is not configured." },
    });
  }

  try {
    const application = app ?? (app = createApp({ environment }).app);
    return application(req, res);
  } catch (error) {
    console.error(
      "7even API initialization failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return res.status(503).json({
      error: { code: "API_NOT_READY", message: "The API is not ready to accept requests." },
    });
  }
}
