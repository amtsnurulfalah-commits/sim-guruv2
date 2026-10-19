import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthService } from "./runtime";
import { cookieNames } from "./security";
import { requireEnvironment } from "../env";
export async function pageSession(
  path: string,
  {
    business = true,
    admin = false,
  }: { business?: boolean; admin?: boolean } = {},
) {
  let app: URL;
  try {
    app = new URL(requireEnvironment("core").APP_URL);
  } catch {
    return { state: "unavailable" as const };
  }
  if ((await headers()).get("host") !== app.host)
    redirect(new URL(path, app).toString());
  const token = (await cookies()).get(
    cookieNames(process.env.NODE_ENV === "production").session,
  )?.value;
  if (!token) redirect("/login");
  let session;
  try {
    session = await (await getAuthService()).session(token);
  } catch {
    return { state: "unavailable" as const };
  }
  if (!session) redirect("/login?status=expired");
  if (business && session.scope !== "business") redirect("/akun");
  if (admin && session.role !== "admin") redirect("/dashboard");
  if (business && session.maintenance && session.role !== "admin")
    return { state: "maintenance" as const };
  return { state: "ready" as const, session };
}
