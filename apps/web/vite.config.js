import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (command === "build" && mode === "production" && !String(env.VITE_GATEWAY_URL || "").trim()) {
    throw new Error(
      "Missing VITE_GATEWAY_URL. Configure it in the deployment environment with the HTTPS origin of the deployed āprən gateway."
    );
  }

  return {};
});
