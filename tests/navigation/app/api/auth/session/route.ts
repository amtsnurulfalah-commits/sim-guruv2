import type { SessionDto } from "@/types/auth";
const session: SessionDto = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    username: "fixture",
    fullName: "Pengguna Navigasi Sintetis",
    role: "admin",
  },
  scope: "business",
  expiresAt: "2099-01-01T00:00:00Z",
  idleExpiresAt: "2099-01-01T00:00:00Z",
  onboarding: {
    mustChangePassword: false,
    emailVerified: true,
    securityQuestionReady: true,
  },
  maintenance: false,
};
export async function GET() {
  return Response.json({ ok: true, data: session });
}
export async function POST() {
  return Response.json({ ok: true, data: session });
}
