import { NextResponse } from "next/server";
import { EducationError } from "@/lib/education/engine";
import { signInLearningAccount } from "@/lib/education/learning-accounts";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Pragma": "no-cache" } });
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    // Next's dev/reverse proxy may canonicalize request.url to localhost while
    // the browser uses 127.0.0.1. Host is the actual HTTP destination, not an
    // arbitrary X-Forwarded-Host supplied by the caller.
    if (origin && origin !== new URL(request.url).origin && new URL(origin).host !== request.headers.get("host")) return json({ error: "请从本站登录页面进入。" }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "请求格式无效。" }, 400);
    if (Number(request.headers.get("content-length") ?? 0) > 2000) return json({ error: "请求内容过长。" }, 413);
    const raw = await request.text();
    if (raw.length > 2000) return json({ error: "请求内容过长。" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "请求格式无效。" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "请求格式无效。" }, 400);
    return json(await signInLearningAccount(body));
  } catch (error) {
    return json({ error: error instanceof EducationError ? error.message : "课程登录暂时不可用，请稍后重试。" }, error instanceof EducationError ? error.status : 503);
  }
}
