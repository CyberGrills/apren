import handler from "../backend/api/[...path].ts";

// Vercel requires function entry points in the root api/ directory.
// The implementation remains owned by backend/api/.
export default handler;
