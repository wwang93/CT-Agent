import "server-only";
import crypto from "node:crypto";
import { ACTIVE_UNIT_IDS, COURSE, INTERVENTIONS, getInterventionForUnit, type Stage } from "./course";
import { actionId, applyAnswer, applyHint, assertOwner, assertUnlocked, EducationError, requiredText, sessionSummary, unitId, validateTask, redactText } from "./engine";
import { readRecord, writeRecord, listRecords } from "./store";
import { coachReply, PROMPT_VERSION } from "./coach";
import { aiConfigured, getAISelection, getAIStatus } from "./provider";
import type { Consent, CourseSettings, LearningSession, PublishedTask } from "./types";
import type { UserRole } from "@/lib/types";

type Auth = { userId: string; role: UserRole };
const defaults: CourseSettings = { researchEnabled: false, researchProtocol: "", consentNotice: "", noticeVersion: 0, updatedAt: "" };
const digest = (text: string) => crypto.createHash("sha256").update(text).digest("hex");
export const learnerCode = (id: string) => `L-${digest(`${COURSE.id}:${id}`).slice(0, 12)}`;
function requireRole(auth: Auth, roles: UserRole[]) { if (!roles.includes(auth.role)) throw new EducationError("当前账号没有此操作的权限。", 403); }
async function requireMember(auth: Auth, allowClosed = false) {
  requireRole(auth, ["student"]);
  if (!allowClosed && process.env.EDU_CLASSROOM_ENABLED !== "true") throw new EducationError("正式课堂尚未开放。请等待教师完成数据库权限与隐私配置，目前可使用样板预览。", 503);
  if (!await readRecord(`member:${auth.userId}`)) throw new EducationError("请先使用教师提供的课程邀请码加入课程。", 403);
}
export async function getSettings() { return (await readRecord<CourseSettings>("settings"))?.value ?? defaults; }
export async function overview(auth: Auth) {
  const [settings, configs, sessions, member, consent] = await Promise.all([
    getSettings(), listRecords<PublishedTask>("config:"),
    auth.role === "student" ? listRecords<LearningSession>("session:", auth.userId) : Promise.resolve({ records: [] as LearningSession[], truncated: false }),
    auth.role === "student" ? readRecord(`member:${auth.userId}`) : Promise.resolve(null), readRecord<Consent>(`consent:${auth.userId}`),
  ]);
  const { inviteHash, ...publicSettings } = settings;
  return { user: { id: auth.userId, role: auth.role, learnerCode: learnerCode(auth.userId) }, member: auth.role !== "student" || Boolean(member),
    configs: configs.records.filter((item) => auth.role === "instructor" || (item.published && ACTIVE_UNIT_IDS.includes(item.task.unitId))),
    sessions: sessions.records.map(sessionSummary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    settings: { ...publicSettings, inviteEnabled: Boolean(inviteHash) }, consent: consent?.value ?? { enabled: false, noticeVersion: 0, updatedAt: "" },
    aiEnabled: getAIStatus().configured, ai: getAIStatus(),
    aiAvailability: { deepseek: Boolean(process.env.DEEPSEEK_API_KEY?.trim()), openai: Boolean(process.env.OPENAI_API_KEY?.trim()) },
    classroomEnabled: process.env.EDU_CLASSROOM_ENABLED === "true", truncated: sessions.truncated,
  };
}
export async function loadSession(auth: Auth, id: string) {
  const record = await readRecord<LearningSession>(`session:${id}`);
  if (!record) throw new EducationError("没有找到这次学习记录。", 404);
  if (auth.role === "student") assertOwner(record.value, auth.userId);
  else requireRole(auth, ["instructor"]);
  return record;
}
export async function performAction(auth: Auth, body: Record<string, unknown>) {
  const now = new Date().toISOString();
  switch (body.action) {
    case "join": {
      requireRole(auth, ["student"]);
      if (process.env.EDU_CLASSROOM_ENABLED !== "true") throw new EducationError("正式课堂尚未开放，请先使用样板预览。", 503);
      const settings = await getSettings();
      const code = requiredText(body.code, "邀请码", 40).toUpperCase();
      if (!settings.inviteHash || digest(code) !== settings.inviteHash) throw new EducationError("邀请码无效或已更新，请向教师确认。", 403);
      const key = `member:${auth.userId}`;
      if (!await readRecord(key)) await writeRecord(key, { userId: auth.userId, joinedAt: now }, auth.userId, 0);
      return { joined: true };
    }
    case "invite": {
      requireRole(auth, ["instructor"]);
      const record = await readRecord<CourseSettings>("settings");
      const code = crypto.randomBytes(6).toString("hex").toUpperCase();
      await writeRecord("settings", { ...(record?.value ?? defaults), inviteHash: digest(code), updatedAt: now }, auth.userId, record?.revision ?? 0);
      return { code };
    }
    case "settings": {
      requireRole(auth, ["instructor"]);
      const record = await readRecord<CourseSettings>("settings");
      const enabled = body.researchEnabled === true;
      if (enabled && body.approved !== true) throw new EducationError("请先确认研究方案与告知文本已经获得所需审核。");
      const protocol = enabled ? requiredText(body.researchProtocol, "研究方案编号或名称", 200) : "";
      const notice = enabled ? requiredText(body.consentNotice, "研究告知文本", 4000) : "";
      const changed = record?.value.researchProtocol !== protocol || record?.value.consentNotice !== notice || record?.value.researchEnabled !== enabled;
      const value = { ...(record?.value ?? defaults), researchEnabled: enabled, researchProtocol: protocol, consentNotice: notice, noticeVersion: (record?.value.noticeVersion ?? 0) + (changed ? 1 : 0), updatedAt: now };
      await writeRecord("settings", value, auth.userId, record?.revision ?? 0);
      return { saved: true };
    }
    case "consent": {
      await requireMember(auth, true);
      const settings = await getSettings();
      if (body.enabled === true && (!settings.researchEnabled || body.noticeVersion !== settings.noticeVersion)) throw new EducationError("研究告知已变化，请重新阅读后选择。", 409);
      const key = `consent:${auth.userId}`, previous = await readRecord<Consent>(key);
      await writeRecord(key, { enabled: body.enabled === true, noticeVersion: settings.noticeVersion, updatedAt: now }, auth.userId, previous?.revision ?? 0);
      return { saved: true };
    }
    case "publish": {
      requireRole(auth, ["instructor"]);
      const unit = unitId(body.unitId), key = `config:${unit}`;
      const record = await readRecord<PublishedTask>(key);
      if (body.expectedVersion !== (record?.value.version ?? 0)) throw new EducationError("任务已被更新，请重新加载后编辑。", 409);
      if (body.reviewed !== true) throw new EducationError("请先审核案例、提示、来源与完成标准。");
      if (!Number.isInteger(body.scheduledWeek) || Number(body.scheduledWeek) < 1 || Number(body.scheduledWeek) > 30) throw new EducationError("教学周须为 1—30 的整数，与课程单元编号分别设置。");
      const value: PublishedTask = { task: validateTask(body.task, unit), version: (record?.value.version ?? 0) + 1, published: body.published === true,
        scheduledWeek: Number(body.scheduledWeek), interventionId: getInterventionForUnit(unit)!.id,
        teacherNotes: typeof body.teacherNotes === "string" ? body.teacherNotes.trim().slice(0, 2000) : "", reviewedAt: now, reviewedBy: auth.userId };
      await writeRecord(key, value, auth.userId, record?.revision ?? 0);
      return { config: value };
    }
    case "start": {
      await requireMember(auth);
      const unit = unitId(body.unitId), requestId = actionId(body.requestId);
      const config = await readRecord<PublishedTask>(`config:${unit}`);
      if (!config?.value.published) throw new EducationError("教师尚未发布本单元任务。", 409);
      if (config.value.interventionId !== getInterventionForUnit(unit)!.id) throw new EducationError("请教师审核并发布新的讲义干预版本；旧版记录保留，但不自动纳入本次干预。", 409);
      const own = await listRecords<LearningSession>("session:", auth.userId);
      const existing = own.records.find((item) => item.startRequestId === requestId && item.unitId === unit);
      if (existing) return { session: existing };
      const same = own.records.filter((item) => item.unitId === unit && item.task.version === config.value.version);
      const active = same.find((item) => item.stage !== "complete");
      if (active) return { session: active };
      if (same.length >= 3) throw new EducationError("本版本已有三次学习记录，请先回看记录或联系教师。");
      // Concurrent starts compete for the same attempt slot, not separate IDs.
      const id = digest(`${auth.userId}:${unit}:v${config.value.version}:attempt:${same.length}`).slice(0, 32);
      const session: LearningSession = { id, startRequestId: requestId, ownerId: auth.userId, unitId: unit,
        interventionId: config.value.interventionId, courseVersion: COURSE.version, ai: getAISelection(),
        task: config.value, stage: "initial", entries: [], language: requiredText(body.language ?? "英语", "所学语言", 30), createdAt: now, updatedAt: now };
      try { await writeRecord(`session:${id}`, session, auth.userId, 0); }
      catch (error) {
        if (!(error instanceof EducationError) || error.status !== 409) throw error;
        const concurrent = await readRecord<LearningSession>(`session:${id}`);
        if (!concurrent) throw error;
        return { session: concurrent.value };
      }
      return { session };
    }
    case "answer": case "hint": case "chat": {
      await requireMember(auth);
      const id = requiredText(body.sessionId, "学习记录编号", 64), requestId = actionId(body.requestId);
      const record = await loadSession(auth, id), session = record.value;
      if (session.entries.some((entry) => entry.id === requestId)) return { session };
      if (body.action === "answer" || body.action === "hint") {
        const updated = body.action === "answer" ? applyAnswer(session, { id: requestId, stage: body.stage, text: body.text }, now) : applyHint(session, requestId, now);
        await writeRecord(`session:${id}`, updated, auth.userId, record.revision);
        return { session: updated };
      }
      assertUnlocked(session);
      if (session.stage !== "revision") throw new EducationError("个性化答疑仅在解释与修订阶段开放。", 409);
      if (session.entries.filter((entry) => entry.kind === "chat").length >= 8) throw new EducationError("本次学习已完成八轮答疑。请先整理并提交自己的解释，或向教师求助。");
      if (session.entries.filter((entry) => entry.kind === "chat" || entry.kind === "ai_error").length >= 20) throw new EducationError("本次学习的 AI 请求已达上限，请使用教师提示或联系教师。", 429);
      const text = requiredText(body.text, "问题", 1000);
      const selection = session.ai ?? getAISelection();
      if (!aiConfigured(selection)) throw new EducationError(`${selection.provider === "deepseek" ? "DeepSeek 官方" : "OpenAI"}答疑尚未启用，请使用教师分层提示。`, 503);
      const locked = { ...session, pending: { id: requestId, startedAt: now } };
      await writeRecord(`session:${id}`, locked, auth.userId, record.revision);
      try {
        const answer = await coachReply(session, text);
        const updated: LearningSession = { ...session, pending: undefined, updatedAt: new Date().toISOString(), entries: [...session.entries, { id: requestId, kind: "chat", stage: "revision", text, ...answer, createdAt: now }] };
        await writeRecord(`session:${id}`, updated, auth.userId, record.revision + 1);
        return { session: updated };
      } catch (error) {
        const failed: LearningSession = { ...session, pending: undefined, updatedAt: new Date().toISOString(), entries: [...session.entries,
          { id: crypto.randomUUID(), requestId, kind: "ai_error", stage: "revision", text,
            provider: selection.provider, model: selection.model, thinking: selection.thinking, promptVersion: PROMPT_VERSION,
            errorCode: error instanceof EducationError ? `application_${error.status}` : "provider_unavailable", createdAt: now }] };
        // Error events and lock release use the same compare-and-swap as answers.
        // Use a separate event ID so retrying a failed request cannot look successful.
        await writeRecord(`session:${id}`, failed, auth.userId, record.revision + 1);
        if (error instanceof EducationError) throw error;
        throw new EducationError("AI 服务暂时不可用。你的学习记录没有丢失，可以使用分层提示或稍后重试。", 502);
      }
    }
    case "feedback": {
      requireRole(auth, ["instructor"]);
      const record = await loadSession(auth, requiredText(body.sessionId, "学习记录编号", 64));
      const id = actionId(body.requestId);
      if (record.value.entries.some((item) => item.id === id)) return { saved: true };
      assertUnlocked(record.value);
      const stage: Stage = record.value.stage === "complete" ? "reflection" : record.value.stage;
      const updated: LearningSession = { ...record.value, updatedAt: now, entries: [...record.value.entries, { id, kind: "feedback", stage, text: requiredText(body.text, "教师反馈", 2000), createdAt: now, authorRole: "instructor" }] };
      await writeRecord(`session:${record.value.id}`, updated, record.value.ownerId, record.revision);
      return { saved: true };
    }
    default: throw new EducationError("不支持的操作。");
  }
}
export async function analytics(auth: Auth, forResearch: boolean, includeRecords = false) {
  requireRole(auth, forResearch ? ["researcher"] : ["instructor"]);
  const [all, settings, members] = await Promise.all([listRecords<LearningSession>("session:"), getSettings(), listRecords<{userId: string}>("member:")]);
  // Consent ownership lives in the storage key; enumerate known members, not emails.
  const authorized = new Set<string>();
  if (forResearch && settings.researchEnabled) {
    for (let start = 0; start < members.records.length; start += 20) {
      const batch = members.records.slice(start, start + 20);
      const values = await Promise.all(batch.map((member) => readRecord<Consent>(`consent:${member.userId}`)));
      values.forEach((record, index) => { if (record?.value.enabled && record.value.noticeVersion === settings.noticeVersion) authorized.add(batch[index].userId); });
    }
  }
  const sessions = all.records.filter((session) => !forResearch || authorized.has(session.ownerId));
  const rows = sessions.map((session) => ({ ...sessionSummary(session), learnerCode: learnerCode(session.ownerId) }));
  return { rows, total: rows.length, learners: new Set(sessions.map((item) => item.ownerId)).size, completed: rows.filter((item) => item.stage === "complete").length,
    hints: rows.reduce((sum, row) => sum + row.hints, 0), chats: rows.reduce((sum, row) => sum + row.chats, 0),
    aiErrors: rows.reduce((sum, row) => sum + row.aiErrors, 0),
    members: forResearch ? undefined : members.records.length, researchEnabled: settings.researchEnabled, protocol: settings.researchProtocol,
    truncated: all.truncated || members.truncated, generatedAt: new Date().toISOString(),
    units: [...new Set([...ACTIVE_UNIT_IDS, ...rows.map((row) => row.unitId)])].map((id) => ({ unitId: id, started: rows.filter((row) => row.unitId === id).length, completed: rows.filter((row) => row.unitId === id && row.stage === "complete").length })),
    interventions: INTERVENTIONS.map((item) => ({ id: item.id, title: item.title, ready: item.ready,
      started: rows.filter((row) => row.interventionId === item.id).length,
      completed: rows.filter((row) => row.interventionId === item.id && row.stage === "complete").length })),
    ...(forResearch && includeRecords ? { records: sessions.map((session) => ({
      learnerCode: learnerCode(session.ownerId), sessionId: session.id, unitId: session.unitId,
      interventionId: session.interventionId ?? session.task.interventionId, scheduledWeek: session.task.scheduledWeek,
      courseVersion: session.courseVersion, taskVersion: session.task.version, ai: session.ai,
      taskSnapshot: JSON.parse(redactText(JSON.stringify(session.task.task))), prompts: JSON.parse(redactText(JSON.stringify(session.task.task.prompts))),
      language: redactText(session.language), stage: session.stage, createdAt: session.createdAt, updatedAt: session.updatedAt,
      entries: session.entries.map(({id, kind, stage, text, reply, createdAt, level, model, provider, servedModel, thinking, promptVersion, tokens, inputTokens, outputTokens, latencyMs, requestId, errorCode}) =>
        ({id,kind,stage,text:redactText(text),reply:reply ? redactText(reply) : undefined,createdAt,level,model,provider,servedModel,thinking,promptVersion,tokens,inputTokens,outputTokens,latencyMs,requestId,errorCode})),
    })), exportNotice: "仅含导出时仍同意当前告知版本的学生。假名化并非匿名化；自动遮蔽邮箱和部分电话不保证去除个人信息，分享前必须人工审查。" } : {}),
  };
}
