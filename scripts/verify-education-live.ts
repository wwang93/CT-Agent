/** Explicit, bounded acceptance test. Uses only disposable QA identities and
 * synthetic answers; never enables classroom/research or asserts human review.
 * Run with --with-ai for exactly two real provider calls. Credentials stay in memory.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { TASKS, STAGES, COURSE } from "../lib/education/course";
import { applyAnswer } from "../lib/education/engine";
import { coachReply } from "../lib/education/coach";
import { getSupabaseAdminClient } from "../lib/supabase-server";
import { signInLearningAccount, issueLearningAccount } from "../lib/education/learning-accounts";
import { learningAuthEmail } from "../lib/education/learning-identity";
import { requireAuthenticatedUser } from "../lib/auth-server";
import { loadSession, overview, performAction } from "../lib/education/service";
import { readRecord, writeRecord } from "../lib/education/store";
import type { LearningSession } from "../lib/education/types";

async function main() {
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const args = process.argv.slice(2), targetArg = args.indexOf("--target");
const target = targetArg >= 0 ? args[targetArg + 1] : "http://127.0.0.1:3014";
if (!["http://127.0.0.1:3014", "https://ct-agent-education-psychology-v1.vinowang.chatgpt.site"].includes(target)) throw new Error("Unapproved test destination");
const runId = crypto.randomBytes(4).toString("hex").toUpperCase();
const ids = [`QA-${runId}-A`, `QA-${runId}-B`], users: string[] = [], recordKeys: string[] = [];
const report: any = { target, kind: "synthetic-acceptance", checks: {}, providerCalls: [], cleanup: false };
const client = getSupabaseAdminClient() as any;
const http = async (path: string, token?: string, body?: unknown) => fetch(`${target}${path}`, {
  method: body === undefined ? "GET" : "POST", cache: "no-store",
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: target }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60_000),
});
try {
  const privateText = fs.readFileSync("teacher-access.local.txt", "utf8");
  const code = privateText.match(/个人访问码：([^\r\n]+)/)?.[1].trim();
  assert.ok(code, "Private teacher credential missing");
  const teacherLogin = await signInLearningAccount({ learnerId: "T-001", accessCode: code });
  const teacherToken = teacherLogin.session.access_token;
  const teacher = await requireAuthenticatedUser(new Request("http://localhost/api/education", { headers: { Authorization: `Bearer ${teacherToken}` } }));
  assert.equal(teacher.role, "instructor");
  const state = await overview(teacher);
  assert.equal(state.classroomEnabled, false); assert.equal(state.settings.researchEnabled, false);
  report.checks.classroomAndResearchClosed = true;
  if (args.includes("--prepare-drafts")) for (const unitId of [6, 10]) {
    const existing = await readRecord(`config:${unitId}`);
    // Never overwrite an existing teacher draft or reviewed configuration.
    if (!existing) await performAction(teacher, { action: "saveDraft", unitId, expectedVersion: 0, scheduledWeek: unitId === 6 ? 7 : 10, task: TASKS[unitId], teacherNotes: "讲义适配草稿，等待教师最终审核。" });
  }
  const prepared = await overview(teacher);
  report.checks.drafts = prepared.configs.map((item) => ({ unitId: item.task.unitId, week: item.scheduledWeek, published: item.published, reviewed: Boolean(item.reviewedAt), version: item.version }));
  const students: { auth: { userId: string; role: "student" }; token: string }[] = [];
  for (const learnerId of ids) {
    const issued = await issueLearningAccount(teacher, { learnerId });
    assert.ok(issued.accessCode);
    const login = await signInLearningAccount({ learnerId, accessCode: issued.accessCode });
    const auth = await requireAuthenticatedUser(new Request("http://localhost/api/education", { headers: { Authorization: `Bearer ${login.session.access_token}` } }));
    assert.equal(auth.role, "student"); users.push(auth.userId);
    students.push({ auth: auth as { userId: string; role: "student" }, token: login.session.access_token });
  }
  const [a, b] = students;
  for (const path of ["/api/education", "/api/me", "/api/education?view=teaching", "/api/education?view=research"]) assert.equal((await http(path)).status, 401);
  assert.equal((await http("/api/education", "invalid-token")).status, 401);
  assert.equal((await http("/api/education?view=teaching", a.token)).status, 403);
  assert.equal((await http("/api/education?view=research", a.token)).status, 403);
  assert.equal((await http("/api/education", a.token, { action: "issueLearningId", learnerId: "QA-UNAUTHORIZED" })).status, 403);
  assert.equal((await http("/api/education", a.token, { action: "start", unitId: 6, requestId: crypto.randomUUID() })).status, 503);
  report.checks.httpAuthenticationAndRoles = true;
  for (const publicPath of ["/", "/auth", "/preview?unit=6", "/preview?unit=10"]) assert.equal((await http(publicPath)).status, 200);
  report.checks.publicPages = true;
  for (const table of ["profiles", "course_templates", "events"]) for (const token of [process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, a.token]) {
    const result = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token}` } });
    assert.ok(result.status === 401 || result.status === 403);
  }
  report.checks.directDatabaseDenied = true;
  for (const [index, unitId] of [6, 10].entries()) {
    const owner = students[index].auth, sessionId = `QA-${runId}-${unitId}`, key = `session:${sessionId}`, now = new Date().toISOString();
    recordKeys.push(key);
    let session: LearningSession = { id: sessionId, ownerId: owner.userId, unitId, interventionId: index + 1, courseVersion: COURSE.version,
      task: { task: structuredClone(TASKS[unitId]), version: 1, published: false, scheduledWeek: unitId === 6 ? 7 : 10, teacherNotes: "仅供可清理的技术验收，不是教师审核或正式课堂。", reviewedAt: "", reviewedBy: "" },
      ai: { provider: "deepseek", model: process.env.DEEPSEEK_MODEL || "deepseek-flash", thinking: "disabled" }, stage: "initial", language: "英语", entries: [], createdAt: now, updatedAt: now };
    // Admin diagnostic seed: classroom remains closed. No genuine student is enrolled.
    let stored = await writeRecord(key, session, owner.userId, 0);
    session = applyAnswer(session, { id: crypto.randomUUID(), stage: "initial", text: "技术验收：我先依据案例提出一个解释，再核对证据。" }, now);
    stored = await writeRecord(key, session, owner.userId, stored.revision);
    if (args.includes("--with-ai")) {
      const text = unitId === 6 ? "反复阅读后觉得熟悉，但合上书说不出来。该怎样区分意义编码和提取练习？" : "我只有一种解释，怎样先检验证据再提出另一种解释？请只给一个下一步。";
      const answer = await coachReply(session, text); assert.ok(/[\u4e00-\u9fff]/.test(answer.reply)); assert.ok(answer.tokens > 0);
      session = { ...session, entries: [...session.entries, { id: crypto.randomUUID(), kind: "chat", stage: "revision", text, ...answer, createdAt: new Date().toISOString() }] };
      stored = await writeRecord(key, session, owner.userId, stored.revision);
      report.providerCalls.push({ unitId, provider: answer.provider, model: answer.model, servedModel: answer.servedModel, tokens: answer.tokens, latencyMs: answer.latencyMs, chineseReply: true });
    }
    for (const stage of STAGES.slice(1)) {
      session = applyAnswer(session, { id: crypto.randomUUID(), stage: stage.id, text: `仅供技术验收的 ${stage.id} 回答，不作为学习成效数据。` }, new Date().toISOString());
      stored = await writeRecord(key, session, owner.userId, stored.revision);
    }
    assert.equal((await loadSession(owner, sessionId)).value.stage, "complete");
    const nonOwner = students[1 - index].auth;
    await assert.rejects(() => loadSession(nonOwner, sessionId));
    assert.equal((await http(`/api/education?session=${sessionId}`, students[1 - index].token)).status, 403);
    assert.equal((await http(`/api/education?session=${sessionId}`, students[index].token)).status, 200);
  }
  report.checks.persistenceFourStagesAndOwnership = true;
  const began = Date.now();
  const reads = await Promise.all(Array.from({ length: 100 }, (_, i) => http("/api/education", students[i % 2].token).then(async (r) => {
    const data = await r.json(); return { status: r.status, ownOnly: data.sessions?.every((s: any) => s.id === `QA-${runId}-${i % 2 ? 10 : 6}`) };
  })));
  assert.ok(reads.every((r) => r.status === 200 && r.ownOnly));
  report.checks.concurrentReads = { requested: 100, succeeded: reads.length, syntheticIdentities: 2, durationMs: Date.now() - began, not100UniqueLoginsOrModelCalls: true };
} catch {
  report.failed = true; process.exitCode = 1;
} finally {
  // Resolve only aliases allocated for this run; never delete by a broad prefix.
  const found = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const user of found.data?.users ?? []) if (ids.some((id) => learningAuthEmail(id) === user.email) && !users.includes(user.id)) users.push(user.id);
  let cleanupOk = !found.error;
  const keys = [...recordKeys, ...ids.map((id) => `learning-account:${id}`), ...users.flatMap((id) => [`learning-user:${id}`, `member:${id}`, `teaching-ack:${id}`, `consent:${id}`]), ...ids.map((id) => `login-limit:id:${crypto.createHash("sha256").update(id).digest("hex")}`)];
  for (const key of keys) { const result = await client.from("course_templates").delete().eq("course_id", COURSE.id).eq("week_number", 0).eq("assignment_id", `edu:${key}`); cleanupOk &&= !result.error; }
  for (const userId of users) { const result = await client.from("profiles").delete().eq("user_id", userId); cleanupOk &&= !result.error; const removed = await client.auth.admin.deleteUser(userId); cleanupOk &&= !removed.error; }
  report.cleanup = cleanupOk; if (!cleanupOk) process.exitCode = 1;
  console.log(JSON.stringify(report, null, 2));
}
}
void main().catch(() => { console.error("验收中断，请检查受控测试记录及清理状态；未输出凭证或供应商原始错误。"); process.exitCode = 1; });
