import "server-only";
import { createAuthHandlers } from "./http";
import { getAuthService } from "./runtime";
import { requireEnvironment } from "../env";
export const authHandlers = createAuthHandlers({ service: getAuthService, config: () => ({ appUrl: requireEnvironment("core").APP_URL, sessionSecret: requireEnvironment("auth").SESSION_SECRET, production: process.env.NODE_ENV === "production", vercel: process.env.VERCEL === "1" }) });
