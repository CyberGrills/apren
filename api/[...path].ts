// Vercel only discovers Serverless Functions under the project-root api/ directory.
// Keep this file as a thin deployment adapter; application logic lives in backend/.
export { default } from "../backend/api/[...path].ts";
