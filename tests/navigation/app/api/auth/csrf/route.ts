export async function GET() {
  return Response.json({ ok: true, data: { csrfToken: "fixture-only" } });
}
