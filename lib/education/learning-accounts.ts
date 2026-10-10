import "server-only";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { COURSE } from "./course";
import { EducationError } from "./engine";
import { listRecords, readRecord, writeRecord } from "./store";
import { generateAccessCode, learningAuthEmail, normalizeLearningId, validateAccessCode, type LearningAccount } from "./learning-identity";

type Auth = { userId: string; role: UserRole };
const accountKey = (id: string) => `learning-account:${id}`;
function instructor(auth: Auth) {
  if (auth.role !== "instructor") throw new EducationError("只有教师可以管理学习 ID。", 403);
}
export async function listLearningAccounts(auth: Auth) {
  instructor(auth);
  const result = await listRecords<LearningAccount>("learning-account:");
  return { accounts: result.records.filter((item) => (item.role ?? "student") === "student").map(({ learnerId, status, createdAt, resetAt }) => ({ learnerId, status, createdAt, resetAt })), truncated: result.truncated };
}

async function assertManagedIdentity(userId: string, id: string, role: "student" | "instructor") {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.auth.admin.getUserById(userId);
  const metadata = data.user?.app_metadata;
  if (error || metadata?.managed_learning_course !== COURSE.id || metadata?.managed_learning_id !== id || (metadata.managed_learning_role ?? "student") !== role || data.user?.email !== learningAuthEmail(id)) {
    throw new EducationError("该身份不属于本课程对应权限的托管账号，操作已停止。", 409);
  }
  const profile = await (client as any).from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (profile.error || (profile.data && profile.data.role !== role)) throw new EducationError("无法确认身份权限，操作已停止。", 409);
  return data.user;
}

// Recover an interrupted create without adopting an unrelated existing account.
async function recoverProvisionedUser(id: string, role: "student" | "instructor") {
  const client = getSupabaseAdminClient();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new EducationError("身份创建尚未完成，请稍后重试或联系管理员。", 503);
    const user = data.users.find((item) => item.email === learningAuthEmail(id));
    if (user) return (await assertManagedIdentity(user.id, id, role)).id;
    if (data.users.length < 100) break;
  }
  return null;
}

export async function issueLearningAccount(auth: Auth, body: Record<string, unknown>) {
  instructor(auth);
  if (normalizeLearningId(body.learnerId).startsWith("T-")) throw new EducationError("T- 开头的 ID 保留给管理员配置的教师身份。", 400);
  return provisionIdentity(auth, body, "student");
}

// Administrator-only entry point for a trusted local setup, deliberately not
// exposed through any API route or client-controlled role field.
export async function bootstrapInstructorIdentity(learnerId: string) {
  const id = normalizeLearningId(learnerId);
  if (!id.startsWith("T-")) throw new EducationError("教师 ID 须以 T- 开头。", 400);
  const existing = await (getSupabaseAdminClient() as any).from("profiles").select("user_id", { count: "exact", head: true }).eq("role", "instructor");
  if (existing.error || existing.count !== 0) throw new EducationError("已有教师身份或状态无法确认，不能自动配置首个教师。", 409);
  return provisionIdentity({ userId: "authorized-local-administrator", role: "instructor" }, { learnerId: id }, "instructor");
}

async function provisionIdentity(auth: Auth, body: Record<string, unknown>, role: "student" | "instructor") {
  const id = normalizeLearningId(body.learnerId), key = accountKey(id);
  let record = await readRecord<LearningAccount>(key);
  if (record && (record.value.role ?? "student") !== role) throw new EducationError("ID 已属于其他权限身份，不允许升级或覆盖。", 409);
  if (record?.value.status === "active") return { skipped: true, learnerId: id };
  if (record?.value.status === "resetting") throw new EducationError("该 ID 正在重置，请使用重置访问码操作继续。", 409);
  const code = body.accessCode === undefined || body.accessCode === "" ? generateAccessCode() : validateAccessCode(body.accessCode);
  const client = getSupabaseAdminClient();
  if (!record) record = await writeRecord(key, { learnerId: id, role, status: "provisioning", credentialVersion: crypto.randomUUID(), createdBy: auth.userId, createdAt: new Date().toISOString() }, auth.userId, 0);
  // CAS lock also protects retries and two teachers assigning the same ID.
  record = await writeRecord(key, { ...record.value, credentialVersion: crypto.randomUUID() }, auth.userId, record.revision);
  const version = record.value.credentialVersion;
  let userId = record.value.userId ?? await recoverProvisionedUser(id, role);
  if (!userId) {
    const { data, error } = await client.auth.admin.createUser({
      email: learningAuthEmail(id), password: code, email_confirm: true,
      app_metadata: { managed_learning_course: COURSE.id, managed_learning_id: id, managed_learning_role: role, learning_credential_version: version },
    });
    if (error || !data.user) throw new EducationError("学习身份创建失败。请重试相同 ID；不会覆盖已有账号或发出邮件。", 503);
    userId = data.user.id;
    record = await writeRecord(key, { ...record.value, userId }, auth.userId, record.revision);
  } else {
    await assertManagedIdentity(userId, id, role);
    const { error } = await client.auth.admin.updateUserById(userId, { password: code, app_metadata: { learning_credential_version: version } });
    if (error) throw new EducationError("恢复身份失败，请重试相同 ID。", 503);
    record = await writeRecord(key, { ...record.value, userId }, auth.userId, record.revision);
  }
  const existingProfile = await (client as any).from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (existingProfile.error || (existingProfile.data && existingProfile.data.role !== role)) throw new EducationError("无法确认对应权限，操作已停止。", 409);
  if (!existingProfile.data) {
    const { error } = await (client as any).from("profiles").insert({ user_id: userId, role });
    if (error) throw new EducationError("学生权限尚未保存，请重试相同 ID。", 503);
  }
  const mapping = await readRecord<{ learnerId: string; userId: string }>(`learning-user:${userId}`);
  if (mapping && mapping.value.learnerId !== id) throw new EducationError("学习身份映射冲突，操作已停止。", 409);
  if (!mapping) await writeRecord(`learning-user:${userId}`, { learnerId: id, userId }, userId, 0);
  if (role === "student") {
    const member = await readRecord(`member:${userId}`);
    if (!member) await writeRecord(`member:${userId}`, { userId, joinedAt: new Date().toISOString(), issuedBy: auth.userId }, userId, 0);
  }
  await writeRecord(key, { ...record.value, userId, status: "active" }, auth.userId, record.revision);
  // No plaintext access code is stored in course data or audit records.
  return { learnerId: id, accessCode: code, skipped: false };
}

export async function resetLearningAccessCode(auth: Auth, body: Record<string, unknown>) {
  instructor(auth);
  const id = normalizeLearningId(body.learnerId), key = accountKey(id);
  let record = await readRecord<LearningAccount>(key);
  if (!record?.value.userId || record.value.status === "provisioning") throw new EducationError("该 ID 尚未创建完成，请先完成创建。", 409);
  if ((record.value.role ?? "student") !== "student") throw new EducationError("教师访问码须由管理员重置，学生管理入口不能操作。", 403);
  await assertManagedIdentity(record.value.userId, id, "student");
  const code = body.accessCode === undefined || body.accessCode === "" ? generateAccessCode() : validateAccessCode(body.accessCode);
  const version = crypto.randomUUID();
  record = await writeRecord(key, { ...record.value, status: "resetting", credentialVersion: version }, auth.userId, record.revision);
  const { error } = await getSupabaseAdminClient().auth.admin.updateUserById(record.value.userId!, { password: code, app_metadata: { learning_credential_version: version } });
  if (error) throw new EducationError("重置尚未完成，账号暂时不能登录。请重新执行重置。", 503);
  await writeRecord(key, { ...record.value, status: "active", resetAt: new Date().toISOString() }, auth.userId, record.revision);
  return { learnerId: id, accessCode: code };
}

type Limit = { window: number; count: number };
async function consumeLimit(key: string, max: number, now: number) {
  const window = Math.floor(now / (5 * 60_000));
  for (let attempt = 0; attempt < 16; attempt++) {
    const previous = await readRecord<Limit>(key);
    const count = previous?.value.window === window ? previous.value.count : 0;
    if (count >= max) throw new EducationError("尝试过于频繁，请等待五分钟或向教师确认访问码。", 429);
    try { await writeRecord(key, { window, count: count + 1 }, "learning-login-rate-limit", previous?.revision ?? 0); return; }
    catch (error) { if (!(error instanceof EducationError) || error.status !== 409) throw error; }
  }
  throw new EducationError("登录请求较多，请稍后再试。", 429);
}
export async function consumeLearningLoginLimit(id: string, now = Date.now(), knownId = true) {
  // No client-supplied IP header is trusted; caps are durable across Worker isolates.
  const digest = crypto.createHash("sha256").update(id).digest("hex");
  // Shards avoid a single CAS row becoming a classroom-wide contention point.
  await consumeLimit(`login-limit:course:${parseInt(digest.slice(0, 2), 16) % 32}`, 20, now);
  if (knownId) await consumeLimit(`login-limit:id:${digest}`, 10, now);
}

export async function signInLearningAccount(body: Record<string, unknown>) {
  const id = normalizeLearningId(body.learnerId);
  const known = await readRecord<LearningAccount>(accountKey(id));
  // Random nonexistent IDs cannot create unbounded per-ID limiter records.
  await consumeLearningLoginLimit(id, Date.now(), Boolean(known));
  const code = validateAccessCode(body.accessCode);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new EducationError("课程登录服务尚未配置。", 503);
  // Never sign in on the global service-role client: it would replace its auth context.
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: learningAuthEmail(id), password: code });
  if (error?.status === 429) throw new EducationError("登录服务请求较多，请稍后重试；不要连续点击。", 429);
  if (error && (error.status ?? 0) >= 500) throw new EducationError("登录服务暂时不可用，请稍后重试。", 503);
  if (error || !data.session || !data.user) throw new EducationError("学习 ID 或访问码不正确，请向教师确认。", 401);
  const record = await readRecord<LearningAccount>(accountKey(id));
  const profile = await (getSupabaseAdminClient() as any).from("profiles").select("role").eq("user_id", data.user.id).maybeSingle();
  if (!record || record.value.status !== "active" || record.value.userId !== data.user.id || profile.error || profile.data?.role !== (record.value.role ?? "student") || data.user.app_metadata.learning_credential_version !== record.value.credentialVersion) {
    throw new EducationError("学习身份暂不可用，请联系教师。", 403);
  }
  return { learnerId: id, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } };
}

export async function verifiedLearningId(userId: string): Promise<string | undefined> {
  return (await readRecord<{ learnerId: string }>(`learning-user:${userId}`))?.value.learnerId;
}

export async function assertLearningSession(userId: string, metadata: Record<string, unknown>, token: string) {
  const id = await verifiedLearningId(userId);
  if (!id && metadata.managed_learning_course !== COURSE.id) return;
  if (!id) throw new EducationError("学习身份尚未创建完成，请联系教师。", 403);
  const record = await readRecord<LearningAccount>(accountKey(id));
  let version: unknown;
  try { version = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).app_metadata?.learning_credential_version; } catch { /* Fail closed after Supabase verifies the token. */ }
  if (!record || record.value.userId !== userId || record.value.status !== "active" || version !== record.value.credentialVersion) {
    throw new EducationError("访问码已更新或账号暂不可用，请重新登录或联系教师。", 401);
  }
  return { id, role: record.value.role ?? "student" };
}
