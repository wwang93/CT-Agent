/** Explicitly authorized staff setup. No credentials are printed or sent to source control. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { requireAuthenticatedUser } from "../lib/auth-server";
import { getSupabaseAdminClient } from "../lib/supabase-server";
import { COURSE, TASKS } from "../lib/education/course";
import { generateAccessCode, validateAccessCode, type LearningAccount } from "../lib/education/learning-identity";
import { provisionStaffIdentity, signInLearningAccount } from "../lib/education/learning-accounts";
import { analytics, loadSession, overview } from "../lib/education/service";
import { listRecords, writeRecord } from "../lib/education/store";
import type { LearningSession } from "../lib/education/types";

type Row = { learnerId: string; role: "instructor" | "researcher"; accessCode: string };
const targets = [{ learnerId: "T-002", role: "instructor" }, { learnerId: "R-001", role: "researcher" }, { learnerId: "R-002", role: "researcher" }] as const;
async function main() {
  process.umask(0o077);
  loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  assert.equal(process.env.SUPABASE_URL, "https://qnaxkstouwtscycuwgkm.supabase.co", "Wrong course database");
  assert.equal(process.env.EDU_CLASSROOM_ENABLED, "false", "Do not open classroom during staff setup");
  const targetIndex = process.argv.indexOf("--target"), target = targetIndex < 0 ? undefined : process.argv[targetIndex + 1];
  if (target) assert.ok(["http://127.0.0.1:3014", "https://ct-agent-education-psychology-v1.vinowang.chatgpt.site"].includes(target), "Unapproved test destination");
  const checkpoint = path.resolve("staff-access.local.json"), textFile = path.resolve("staff-access.local.txt");
  for (const file of [checkpoint, textFile]) if (fs.existsSync(file)) assert.ok(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink(), "Private output must be a regular file");
  const before = await listRecords<LearningAccount>("learning-account:"); assert.equal(before.truncated, false);
  const preserved = before.records.filter((item) => !targets.some((row) => row.learnerId === item.learnerId));
  assert.equal(preserved.filter((item) => (item.role ?? "student") === "student").length, 100);
  assert.ok(preserved.some((item) => item.learnerId === "T-001" && item.status === "active"));
  let rows: Row[];
  if (fs.existsSync(checkpoint)) {
    const saved = JSON.parse(fs.readFileSync(checkpoint, "utf8")); assert.equal(saved.courseId, COURSE.id);
    rows = saved.accounts;
    assert.deepEqual(rows.map(({ learnerId, role }) => ({ learnerId, role })), targets);
    rows.forEach((row) => validateAccessCode(row.accessCode));
  } else {
    assert.ok(!before.records.some((item) => targets.some((row) => row.learnerId === item.learnerId)), "Refusing to overwrite existing staff credentials");
    rows = targets.map((item) => ({ ...item, accessCode: generateAccessCode() }));
    fs.writeFileSync(checkpoint, JSON.stringify({ courseId: COURSE.id, accounts: rows }, null, 2), { mode: 0o600, flag: "wx" });
  }
  fs.chmodSync(checkpoint, 0o600);
  const staff = [];
  for (const row of rows) {
    await provisionStaffIdentity(row.learnerId, row.role, row.accessCode);
    const login = await signInLearningAccount(row);
    const token = login.session.access_token;
    const auth = await requireAuthenticatedUser(new Request("http://localhost/api/education", { headers: { Authorization: `Bearer ${token}` } }));
    const state = await overview(auth);
    assert.equal(auth.role, row.role); assert.equal(state.user.learnerCode, row.learnerId);
    assert.equal(state.user.canReadAllCourseRecords, row.role === "researcher"); assert.equal(state.classroomEnabled, false);
    staff.push({ ...row, auth, token });
  }
  fs.writeFileSync(textFile, ["教育心理学 · 新增人员账号（私密，请逐人发放）", "登录网址：https://ct-agent-education-psychology-v1.vinowang.chatgpt.site/auth", "现有 T-001 与 100 个学生访问码保持不变。", "", ...rows.flatMap((row) => [`${row.role === "instructor" ? "教师" : "研究管理"} ID：${row.learnerId}`, `个人访问码：${row.accessCode}`, `入口：${row.role === "instructor" ? "/instructor" : "/research"}`, ""]), "R-001 / R-002 可只读查看全班已保存记录，包括未同意或已退出研究的记录，查看会留痕。", "授权研究导出仍只包含当前有效同意的记录。请妥善保管，勿将本文件发给全班或放入研究数据。"].join("\n"), { mode: 0o600 });
  fs.chmodSync(textFile, 0o600);
  const http = async (suffix: string, token?: string, body?: unknown) => {
    assert.ok(target);
    return fetch(`${target}/api/education${suffix}`, { method: body ? "POST" : "GET", cache: "no-store", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json", Origin: target } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60_000) });
  };
  const sessionId = `QA-STAFF-${crypto.randomUUID()}`, key = `session:${sessionId}`, owner = `QA-STAFF-${crypto.randomUUID()}`;
  const now = new Date().toISOString(); let seeded = false, cleanup = false;
  try {
    // Synthetic administrative fixture only. No real student's account or response is changed.
    const fixture: LearningSession = { id: sessionId, ownerId: owner, unitId: 6, interventionId: 1, stage: "revision", language: "英语", createdAt: now, updatedAt: now,
      task: { task: structuredClone(TASKS[6]), version: 1, published: false, scheduledWeek: 7, teacherNotes: "可清理的人员权限技术验收，非正式课堂", reviewedAt: "", reviewedBy: "" },
      entries: [{ id: crypto.randomUUID(), kind: "answer", stage: "initial", text: "仅供权限验收：未授权的合成记录", createdAt: now }, { id: crypto.randomUUID(), kind: "chat", stage: "revision", text: "合成提问", reply: "合成答疑，不调用外部服务", createdAt: now }] };
    await writeRecord(key, fixture, owner, 0); seeded = true;
    for (const item of staff.filter((row) => row.role === "researcher")) {
      const all = target ? await (await http("?view=administration", item.token)).json() : await analytics(item.auth, true, false, true);
      assert.equal(all.accessScope, "course-administration"); assert.ok(all.rows.some((row: any) => row.id === sessionId));
      const selected = target ? (await (await http(`?session=${sessionId}`, item.token)).json()).session : (await loadSession(item.auth, sessionId)).value;
      assert.equal(selected.entries[0].text, fixture.entries[0].text); assert.equal(selected.entries[1].reply, fixture.entries[1].reply);
      const authorized = target ? await (await http("?view=research&export=1", item.token)).json() : await analytics(item.auth, true, true);
      assert.ok(!authorized.rows.some((row: any) => row.id === sessionId));
      if (target) {
        for (const suffix of ["?view=administration&export=1", "?view=learningIds", "?view=teaching"]) assert.equal((await http(suffix, item.token)).status, 403);
        for (const action of ["settings", "publish", "feedback", "issueLearningId", "resetLearningCode"]) assert.equal((await http("", item.token, { action })).status, 403);
      }
    }
    if (target) assert.equal((await http("?view=administration")).status, 401);
  } finally {
    if (seeded) {
      const result = await (getSupabaseAdminClient() as any).from("course_templates").delete().eq("course_id", COURSE.id).eq("week_number", 0).eq("assignment_id", `edu:${key}`);
      assert.ok(!result.error, "Synthetic fixture cleanup failed"); cleanup = true;
    }
  }
  const after = await listRecords<LearningAccount>("learning-account:"); assert.equal(after.truncated, false);
  assert.deepEqual(after.records.filter((item) => !targets.some((row) => row.learnerId === item.learnerId)), preserved, "Existing identities changed");
  const counts = { students: after.records.filter((item) => (item.role ?? "student") === "student").length, teachers: after.records.filter((item) => item.role === "instructor").length, researchers: after.records.filter((item) => item.role === "researcher").length };
  assert.deepEqual(counts, { students: 100, teachers: 2, researchers: 2 });
  console.log(JSON.stringify({ ...counts, verifiedNewLogins: 3, allCourseRecordsVerified: true, unauthorizedResearchExportExcluded: true, syntheticFixtureRemoved: cleanup, preservedExistingAccounts: true, classroomEnabled: false, target: target ?? "direct server verification", privateCredentialFile: textFile }));
}
void main().catch(() => { console.error("人员配置或验收未完成；请检查受控配置与合成记录清理，不输出凭证或原始服务错误。"); process.exitCode = 1; });
