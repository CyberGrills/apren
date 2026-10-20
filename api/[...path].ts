import { createApp } from "../services/platform/src/app.ts";

const vercelEnvironment = process.env.VERCEL_ENV;
const environment =
  vercelEnvironment === "production"
    ? "production"
    : vercelEnvironment === "preview"
      ? "preview"
      : (process.env.NODE_ENV ?? "development");

const { app } = createApp({ environment });

export default app;
