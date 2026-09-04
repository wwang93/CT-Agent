import { NextResponse } from "next/server";
import { AuthError, requireAuthenticatedUser } from "@/lib/auth-server";
import { EducationError } from "@/lib/education/engine";
import { analytics, loadSession, overview, performAction } from "@/lib/education/service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
function failure(error: unknown) {
  if (error instanceof EducationError || error instanceof AuthError) return json({ error: error.message }, error.status);
  return json({ error: "课程服务暂时不可用，请稍后重试。" }, 503);
}
export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request), url = new URL(request.url);
    if (url.searchParams.has("session")) return json({ session: (await loadSession(auth, url.searchParams.get("session")!)).value });
    if (url.searchParams.get("view") === "teaching") return json(await analytics(auth, false));
    if (url.searchParams.get("view") === "research") return json(await analytics(auth, true, url.searchParams.get("export") === "1"));
    return json(await overview(auth));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (Number(request.headers.get("content-length") ?? 0) > 50_000) return json({ error: "请求内容过长。" }, 413);
    const raw = await request.text();
    if (raw.length > 50_000) return json({ error: "请求内容过长。" }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: "请求格式无效。" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "请求格式无效。" }, 400);
    return json(await performAction(auth, body));
  } catch (error) { return failure(error); }
}
