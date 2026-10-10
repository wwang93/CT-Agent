import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { normalizeLearningId, generateAccessCode, learningAuthEmail, validateAccessCode } from "../lib/education/learning-identity";
import { bootstrapInstructorIdentity, consumeLearningLoginLimit, issueLearningAccount, listLearningAccounts, resetLearningAccessCode, signInLearningAccount } from "../lib/education/learning-accounts";
import { requireAuthenticatedUser } from "../lib/auth-server";
import { overview, performAction, loadSession, analytics } from "../lib/education/service";
import { TASKS } from "../lib/education/course";
import { POST } from "../app/api/education/learning-login/route";

test("learning IDs are canonical, internal aliases are deterministic and codes are private credentials", () => {
  assert.equal(normalizeLearningId(" l-001 "), "L-001");
  for (const id of ["", "01", "学生姓名", "a@example.com", "A_123", "A".repeat(25)]) assert.throws(() => normalizeLearningId(id));
  assert.equal(learningAuthEmail("l-001"), learningAuthEmail("L-001"));
  assert.notEqual(learningAuthEmail("L-001"), learningAuthEmail("L-002"));
  assert.ok(learningAuthEmail("L-001").endsWith("@students.ct-agent.invalid"));
  const codes = Array.from({ length: 100 }, () => generateAccessCode());
  assert.equal(new Set(codes).size, 100); assert.ok(codes.every((code) => /^C[A-F0-9]{24}$/.test(code)));
  assert.equal(validateAccessCode("Manual_Access_123"), "Manual_Access_123");
  for (const code of ["short", "x".repeat(12), "=FORMULA123456", "-A123456789012", "1234567890123456", "has,a,comma123", " space123456789"]) assert.throws(() => validateAccessCode(code));
});

function fakeBackend() {
  const tables: Record<string, any[]> = { course_templates: [], profiles: [] };
  const users = new Map<string, any>(), passwords = new Map<string, string>(), tokens = new Map<string, string>();
  let failMapping = false;
  const client = {
    auth: {
      getUser: async (token: string) => ({ data: { user: users.get(tokens.get(token) ?? "") ?? null }, error: tokens.has(token) ? null : { message: "invalid" } }),
      admin: {
        createUser: async (body: any) => {
          if ([...users.values()].some((user) => user.email === body.email)) return { data: { user: null }, error: { message: "duplicate" } };
          const user = { id: crypto.randomUUID(), email: body.email, app_metadata: { provider: "email", ...body.app_metadata } };
          users.set(user.id, user); passwords.set(user.id, body.password); return { data: { user }, error: null };
        },
        getUserById: async (id: string) => ({ data: { user: users.get(id) }, error: null }),
        listUsers: async ({ page, perPage }: any) => ({ data: { users: [...users.values()].slice((page - 1) * perPage, page * perPage) }, error: null }),
        updateUserById: async (id: string, body: any) => {
          const user = users.get(id); if (!user) return { error: { message: "missing" } };
          if (body.password) passwords.set(id, body.password);
          Object.assign(user.app_metadata, body.app_metadata ?? {}); return { data: { user }, error: null };
        },
      },
    },
    from(table: string) {
      let filters: ((row: any) => boolean)[] = [], operation = "read", payload: any = {}, range = [0, Infinity];
      const query: any = { select: () => query, eq: (key: string, value: any) => { filters.push((row) => row[key] === value); return query; }, like: (key: string, value: string) => { filters.push((row) => String(row[key]).startsWith(value.slice(0, -1))); return query; }, order: () => query, range: (a: number, b: number) => { range = [a, b]; return query; }, insert: (value: any) => { operation = "insert"; payload = value; return query; }, update: (value: any) => { operation = "update"; payload = value; return query; }, upsert: (value: any) => { operation = "upsert"; payload = value; return query; }, maybeSingle: () => execute(true), single: () => execute(true), then: (resolve: any, reject: any) => execute(false).then(resolve, reject) };
      async function execute(single: boolean) {
        const rows = tables[table];
        if (operation === "insert" || operation === "upsert") {
          if (failMapping && String(payload.assignment_id).startsWith("edu:learning-user:")) { failMapping = false; return { data: null, error: { code: "test-outage" } }; }
          const index = rows.findIndex((row) => table === "profiles" ? row.user_id === payload.user_id : row.assignment_id === payload.assignment_id);
          if (index >= 0 && operation === "insert") return { data: null, error: { code: "23505" } };
          const row = structuredClone(payload); if (index >= 0) rows[index] = row; else rows.push(row); return { data: single ? row : [row], error: null };
        }
        const found = rows.filter((row) => filters.every((filter) => filter(row))).slice(range[0], range[1] + 1);
        if (operation === "update") found.forEach((row) => Object.assign(row, structuredClone(payload)));
        return { data: structuredClone(single ? found[0] ?? null : found), error: null, count: found.length };
      }
      return query;
    },
  };
  const fetchAuth: typeof fetch = async (url, init) => {
    assert.ok(String(url).includes("/auth/v1/token?grant_type=password"));
    const body = JSON.parse(String(init?.body)), user = [...users.values()].find((item) => item.email === body.email && passwords.get(item.id) === body.password);
    if (!user) return new Response(JSON.stringify({ error_code: "invalid_credentials", message: "invalid" }), { status: 400, headers: { "Content-Type": "application/json" } });
    const claims = { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: user.app_metadata, session_id: crypto.randomUUID() };
    const token = `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
    tokens.set(token, user.id);
    return new Response(JSON.stringify({ access_token: token, refresh_token: crypto.randomUUID(), token_type: "bearer", expires_in: 3600, user }), { headers: { "Content-Type": "application/json" } });
  };
  return { client, tables, users, tokens, fetchAuth, interruptMapping: () => { failMapping = true; } };
}

test("managed learning accounts keep ownership across login/reset and fail closed on misuse or interruption", async (t) => {
  const fake = fakeBackend(), priorFetch = globalThis.fetch;
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "EDU_CLASSROOM_ENABLED"];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => { globalThis.fetch = priorFetch; for (const key of keys) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key]; } delete (globalThis as any).__CT_AGENT_SUPABASE_SERVER__; });
  process.env.SUPABASE_URL = "https://test.invalid"; process.env.SUPABASE_SERVICE_ROLE_KEY = "test-admin";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.invalid"; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-public"; process.env.EDU_CLASSROOM_ENABLED = "true";
  (globalThis as any).__CT_AGENT_SUPABASE_SERVER__ = fake.client; globalThis.fetch = fake.fetchAuth;
  const teacher = { userId: "teacher", role: "instructor" as const }, student = { userId: "outsider", role: "student" as const }, researcher = { userId: "research", role: "researcher" as const };
  const staff = await bootstrapInstructorIdentity("T-001");
  const staffLogin = await signInLearningAccount({ learnerId: "T-001", accessCode: staff.accessCode });
  const staffAuth = await requireAuthenticatedUser(new Request("http://localhost/api/education", { headers: { Authorization: `Bearer ${staffLogin.session.access_token}` } }));
  assert.equal(staffAuth.role, "instructor");
  assert.equal((await overview(staffAuth)).user.learnerCode, "T-001");
  await assert.rejects(() => bootstrapInstructorIdentity("T-002"), /已有教师/);
  await assert.rejects(() => issueLearningAccount(teacher, { learnerId: "T-001" }), /保留/);
  await assert.rejects(() => resetLearningAccessCode(teacher, { learnerId: "T-001" }), /管理员/);
  await assert.rejects(() => issueLearningAccount(student, { learnerId: "L-001" }));
  await assert.rejects(() => listLearningAccounts(researcher));
  await assert.rejects(() => resetLearningAccessCode(student, { learnerId: "L-001" }));
  const a = await issueLearningAccount(teacher, { learnerId: "l-001", accessCode: "Manual_Access_123", role: "instructor" });
  const b = await issueLearningAccount(teacher, { learnerId: "L-002" });
  assert.equal(a.accessCode, "Manual_Access_123"); assert.ok(b.accessCode);
  assert.equal((await issueLearningAccount(teacher, { learnerId: "L-001", accessCode: "DoNotChange_123" })).skipped, true);
  assert.ok(!JSON.stringify(fake.tables).includes(a.accessCode!)); assert.ok(!JSON.stringify(fake.tables).includes(b.accessCode!));
  assert.ok(!JSON.stringify(await listLearningAccounts(teacher)).includes("credentialVersion"));
  await assert.rejects(() => signInLearningAccount({ learnerId: "L-001", accessCode: "Wrong_Access_123" }), /不正确/);
  const first = await signInLearningAccount({ learnerId: "L-001", accessCode: a.accessCode });
  const second = await signInLearningAccount({ learnerId: "L-002", accessCode: b.accessCode });
  const request = (token: string) => new Request("http://localhost/api/education", { headers: { Authorization: `Bearer ${token}` } });
  const authA = await requireAuthenticatedUser(request(first.session.access_token)), authB = await requireAuthenticatedUser(request(second.session.access_token));
  assert.equal(authA.role, "student"); assert.notEqual(authA.userId, authB.userId);
  assert.ok((await listLearningAccounts(teacher)).accounts.every((account) => !account.learnerId.startsWith("T-")), "teacher credentials are not in the student roster");
  assert.equal((await overview(authA)).user.learnerCode, "L-001"); assert.equal((await overview(authA)).member, true);
  await performAction(teacher, { action: "teachingPrivacy", notice: "测试用教学记录说明，不涉及真实学生", contact: "测试教师，课堂联系", retention: "测试结束清理", reviewed: true });
  await performAction(authA, { action: "acknowledgeTeachingNotice", version: 1, acknowledged: true });
  await performAction(teacher, { action: "publish", unitId: 6, expectedVersion: 0, scheduledWeek: 7, reviewed: true, published: true, task: TASKS[6] });
  const started = await performAction(authA, { action: "start", unitId: 6, requestId: crypto.randomUUID() }) as any;
  await performAction(authA, { action: "answer", sessionId: started.session.id, stage: "initial", text: "仅供测试的初答", requestId: crypto.randomUUID() });
  await assert.rejects(() => loadSession(authB, started.session.id));
  assert.equal((await overview(authB)).sessions.length, 0);
  assert.equal((await analytics(teacher, false)).rows[0].learnerCode, "L-001");
  assert.equal((await analytics(researcher, true, true)).total, 0);
  const reset = await resetLearningAccessCode(teacher, { learnerId: "L-001" });
  await assert.rejects(() => signInLearningAccount({ learnerId: "L-001", accessCode: a.accessCode }), /不正确/);
  await assert.rejects(() => requireAuthenticatedUser(request(first.session.access_token)), /访问码已更新/);
  const next = await signInLearningAccount({ learnerId: "L-001", accessCode: reset.accessCode });
  const after = await requireAuthenticatedUser(request(next.session.access_token));
  assert.equal(after.userId, authA.userId); assert.equal((await loadSession(after, started.session.id)).value.entries[0].text, "仅供测试的初答");
  assert.equal((await overview(after)).sessions[0].id, started.session.id);
  fake.interruptMapping(); await assert.rejects(() => issueLearningAccount(teacher, { learnerId: "L-003" }));
  const beforeCount = fake.users.size;
  const repaired = await issueLearningAccount(teacher, { learnerId: "L-003" });
  assert.ok(repaired.accessCode); assert.equal(fake.users.size, beforeCount, "repair must retain the same Auth identity");
  const simultaneous = await Promise.allSettled([issueLearningAccount(teacher, { learnerId: "L-004" }), issueLearningAccount(teacher, { learnerId: "L-004" })]);
  await issueLearningAccount(teacher, { learnerId: "L-004" });
  assert.equal([...fake.users.values()].filter((item) => item.email === learningAuthEmail("L-004")).length, 1);
  assert.ok(simultaneous.some((item) => item.status === "rejected"), "CAS rejects competing writes");
  for (let i = 0; i < 10; i++) await consumeLearningLoginLimit("L-RATE", 1000);
  await assert.rejects(() => consumeLearningLoginLimit("L-RATE", 1000), /频繁/);
  await consumeLearningLoginLimit("L-RATE", 301_000);
  const headers = { "Content-Type": "application/json", Origin: "https://other.invalid" };
  const denied = await POST(new Request("http://localhost/api/education/learning-login", { method: "POST", headers, body: "{}" }));
  assert.equal(denied.status, 403); assert.ok(denied.headers.get("cache-control")?.includes("no-store"));
  assert.equal((await POST(new Request("http://localhost/api/education/learning-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "[]" }))).status, 400);
  assert.equal((await POST(new Request("http://localhost:3013/api/education/learning-login", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3013", Host: "127.0.0.1:3013" }, body: "{}" }))).status, 400, "same destination survives the local reverse proxy");
});
