/** Authorized one-course roster setup. Never logs credentials or resets active IDs. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { generateAccessCode } from "../lib/education/learning-identity";
import { issueLearningAccount, listLearningAccounts, signInLearningAccount } from "../lib/education/learning-accounts";
import { requireAuthenticatedUser } from "../lib/auth-server";
import { overview } from "../lib/education/service";

type Row = { learnerId: string; accessCode: string; issued: boolean; verified: boolean };
async function main() {
  process.umask(0o077);
  loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  assert.equal(process.env.SUPABASE_URL, "https://qnaxkstouwtscycuwgkm.supabase.co", "Wrong course database");
  assert.equal(process.env.EDU_CLASSROOM_ENABLED, "false", "Classroom must remain closed");
  const code = fs.readFileSync("teacher-access.local.txt", "utf8").match(/个人访问码：([^\r\n]+)/)?.[1].trim();
  assert.ok(code, "Missing private teacher credential");
  const teacher = await signInLearningAccount({ learnerId: "T-001", accessCode: code });
  const auth = await requireAuthenticatedUser(new Request("http://localhost/api/education", { headers: { Authorization: `Bearer ${teacher.session.access_token}` } }));
  assert.equal(auth.role, "instructor");
  const state = await overview(auth);
  assert.equal(state.classroomEnabled, false);
  const targetIds = Array.from({ length: 100 }, (_, i) => `L-${String(i + 1).padStart(3, "0")}`);
  const directory = path.resolve("outputs/education-roster-20261010");
  const checkpoint = path.join(directory, "credentials.private.json");
  const existing = await listLearningAccounts(auth);
  assert.equal(existing.truncated, false, "Roster query incomplete");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  assert.ok(!fs.lstatSync(directory).isSymbolicLink(), "Private directory cannot be a symlink");
  fs.chmodSync(directory, 0o700);
  let rows: Row[];
  if (fs.existsSync(checkpoint)) {
    assert.ok(!fs.lstatSync(checkpoint).isSymbolicLink(), "Checkpoint cannot be a symlink");
    const saved = JSON.parse(fs.readFileSync(checkpoint, "utf8"));
    assert.equal(saved.courseId, "0833032");
    rows = saved.accounts;
    assert.deepEqual(rows.map(row => row.learnerId), targetIds);
  } else {
    assert.ok(!existing.accounts.some(row => targetIds.includes(row.learnerId)), "Existing target IDs: refusing to overwrite or guess credentials");
    rows = targetIds.map(learnerId => ({ learnerId, accessCode: generateAccessCode(), issued: false, verified: false }));
    assert.equal(new Set(rows.map(row => row.accessCode)).size, 100);
    fs.writeFileSync(checkpoint, JSON.stringify({ courseId: "0833032", accounts: rows }, null, 2), { mode: 0o600, flag: "wx" });
  }
  const save = () => {
    const temporary = path.join(directory, "credentials.pending.json");
    fs.writeFileSync(temporary, JSON.stringify({ courseId: "0833032", accounts: rows }, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, checkpoint);
    fs.chmodSync(checkpoint, 0o600);
  };
  // Four independent identities at a time; interrupted creates use the same private code.
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < rows.length) {
      const row = rows[next++];
      if (row.issued) continue;
      const result = await issueLearningAccount(auth, { learnerId: row.learnerId, accessCode: row.accessCode });
      if (!result.skipped) assert.equal(result.accessCode, row.accessCode);
      row.issued = true; save();
      const total = rows.filter(item => item.issued).length;
      if (total % 10 === 0) console.log(`Created ${total}/100 student identities`);
    }
  }));
  // Sequential native sign-ins verify every ID/code without a class-wide login burst.
  for (const [index, row] of rows.entries()) {
    if (!row.verified) {
      let login;
      for (let retry = 0; retry < 4; retry++) {
        try { login = await signInLearningAccount({ learnerId: row.learnerId, accessCode: row.accessCode }); break; }
        catch (error) {
          if ((error as { status?: number }).status !== 429 || retry === 3) throw error;
          console.log("Login capacity reached; bounded retry pending");
          await new Promise(resolve => setTimeout(resolve, 30_000));
        }
      }
      assert.ok(login); assert.equal(login.learnerId, row.learnerId);
      row.verified = true; save();
      await new Promise(resolve => setTimeout(resolve, 450));
    }
    if ((index + 1) % 10 === 0) console.log(`Verified ${index + 1}/100 student logins`);
  }
  const finalRoster = await listLearningAccounts(auth);
  assert.ok(targetIds.every(id => finalRoster.accounts.some(row => row.learnerId === id && row.status === "active")));
  const finalState = await overview(auth); assert.equal(finalState.classroomEnabled, false);
  console.log(JSON.stringify({ students: 100, uniqueIds: 100, uniqueCodes: 100, verifiedLogins: rows.filter(row => row.verified).length, classroomEnabled: false, privateRosterDirectory: directory }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Roster setup failed"); process.exitCode = 1; });
