import test from "node:test";
import assert from "node:assert/strict";
import { acquireAIPermit, releaseAIPermit, aiCapacityLimits, aiCapacityStatus, AICapacityError } from "../lib/education/ai-capacity";

function database() {
  const rows: any[] = [];
  return { from() {
    const filters: ((row: any) => boolean)[] = [];
    let op = "read", value: any;
    const q: any = {
      select: () => q,
      eq: (key: string, expected: any) => { filters.push((row) => row[key] === expected); return q; },
      insert: (body: any) => { op = "insert"; value = body; return q; },
      update: (body: any) => { op = "update"; value = body; return q; },
      maybeSingle: async () => {
        if (op === "insert") {
          if (rows.some((row) => row.assignment_id === value.assignment_id)) return { error: { code: "23505" }, data: null };
          rows.push(structuredClone(value)); return { data: structuredClone(value), error: null };
        }
        const row = rows.find((row) => filters.every((f) => f(row)));
        if (op === "update" && row) Object.assign(row, structuredClone(value));
        return { data: row ? structuredClone(row) : null, error: null };
      },
    };
    q.single = q.maybeSingle;
    return q;
  } };
}
function setup(t: any) {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "EDU_AI_MAX_CONCURRENT", "EDU_AI_DAILY_REQUEST_LIMIT"];
  const old = Object.fromEntries(names.map((key) => [key, process.env[key]]));
  process.env.SUPABASE_URL = "https://test.invalid"; process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  delete process.env.EDU_AI_MAX_CONCURRENT; delete process.env.EDU_AI_DAILY_REQUEST_LIMIT;
  (globalThis as any).__CT_AGENT_SUPABASE_SERVER__ = database();
  t.after(() => { for (const name of names) { if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name]; } delete (globalThis as any).__CT_AGENT_SUPABASE_SERVER__; });
}
test("100 simultaneous AI admissions never overcommit the classroom and saturation does not burn budget", async (t) => {
  setup(t); const now = Date.parse("2026-10-10T02:00:00Z");
  const results = await Promise.allSettled(Array.from({ length: 100 }, (_, i) => acquireAIPermit(`simulated-student-${i}`, now)));
  const accepted = results.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
  assert.ok(accepted.length > 0 && accepted.length <= 20);
  assert.equal(new Set(accepted.map((item) => item.slot)).size, accepted.length);
  for (const item of results) if (item.status === "rejected") { assert.ok(item.reason instanceof AICapacityError); assert.equal(item.reason.status, 429); assert.equal(item.reason.retryAfter, 15); }
  assert.equal((await aiCapacityStatus(now)).usedToday, accepted.length);
  await Promise.all(accepted.map(releaseAIPermit));
  const next = await acquireAIPermit("after-release", now); await releaseAIPermit(next);
  assert.equal((await aiCapacityStatus(now)).usedToday, accepted.length + 1);
});
test("daily quota resets in China time; expired owners cannot release a newer request", async (t) => {
  setup(t); process.env.EDU_AI_MAX_CONCURRENT = "1"; process.env.EDU_AI_DAILY_REQUEST_LIMIT = "2";
  const now = Date.parse("2026-10-10T15:59:00Z");
  const first = await acquireAIPermit("first", now);
  await assert.rejects(() => acquireAIPermit("busy", now), AICapacityError);
  assert.equal((await aiCapacityStatus(now)).usedToday, 1);
  const newer = await acquireAIPermit("new-owner", now + 90_001);
  await releaseAIPermit(first);
  await assert.rejects(() => acquireAIPermit("still-busy", now + 90_002), AICapacityError);
  await releaseAIPermit(newer);
  // The newer request started after midnight, so it belongs to the next day's quota.
  assert.equal((await aiCapacityStatus(now + 90_001)).usedToday, 1);
  const second = await acquireAIPermit("second-today", now + 90_003); await releaseAIPermit(second);
  await assert.rejects(() => acquireAIPermit("quota-exhausted", now + 90_004), /今日答疑次数/);
  assert.equal((await aiCapacityStatus(now + 90_004)).usedToday, 2);
});
test("invalid limits fail closed, rather than silently disabling capacity controls", (t) => {
  setup(t); assert.deepEqual(aiCapacityLimits(), { concurrent: 20, dailyRequests: 1000 });
  for (const value of ["0", "33", "-1", "NaN", "1.5"]) { process.env.EDU_AI_MAX_CONCURRENT = value; assert.throws(aiCapacityLimits); }
  delete process.env.EDU_AI_MAX_CONCURRENT; process.env.EDU_AI_DAILY_REQUEST_LIMIT = "10001"; assert.throws(aiCapacityLimits);
});
