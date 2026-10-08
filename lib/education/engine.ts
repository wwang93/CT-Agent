import { ACTIVE_UNIT_IDS, STAGES, TASKS, type Stage, type Task } from "./course";
import type { Entry, LearningSession } from "./types";

export class EducationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function requiredText(value: unknown, label: string, max = 5000): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new EducationError(`${label}不能为空，且不能超过 ${max} 字符。`);
  return value.trim();
}
export function actionId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new EducationError("请求标识无效，请刷新后重试。");
  return value;
}
export function unitId(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || !ACTIVE_UNIT_IDS.includes(value)) throw new EducationError("本版仅开放干预 1（单元 6）与干预 2（单元 10）；后面三次待教师选定讲义。");
  return value;
}
export function nextStage(stage: Stage): LearningSession["stage"] {
  return STAGES[STAGES.findIndex((item) => item.id === stage) + 1]?.id ?? "complete";
}
export function assertOwner(session: LearningSession, userId: string) {
  if (session.ownerId !== userId) throw new EducationError("不能访问其他同学的学习记录。", 403);
}
export function assertUnlocked(session: LearningSession, now = Date.now()) {
  if (session.pending && now - Date.parse(session.pending.startedAt) < 90_000) throw new EducationError("上一条请求仍在处理，请稍后重试。", 409);
}
export function applyAnswer(session: LearningSession, input: { id: string; stage: unknown; text: unknown }, now: string): LearningSession {
  if (session.entries.some((entry) => entry.id === input.id)) return session;
  assertUnlocked(session);
  if (session.stage === "complete" || input.stage !== session.stage) throw new EducationError("学习阶段已变化，请刷新记录后继续。", 409);
  const text = requiredText(input.text, "你的解释");
  const entry: Entry = { id: input.id, kind: "answer", stage: session.stage, text, createdAt: now };
  return { ...session, pending: undefined, entries: [...session.entries, entry], stage: nextStage(session.stage), updatedAt: now };
}
export function applyHint(session: LearningSession, id: string, now: string): LearningSession {
  if (session.entries.some((entry) => entry.id === id)) return session;
  assertUnlocked(session);
  if (session.stage !== "revision") throw new EducationError("提示仅在解释与修订阶段提供；初始理解和迁移任务需要独立完成。", 409);
  const level = session.entries.filter((entry) => entry.kind === "hint").length;
  if (level >= 3) throw new EducationError("三个层级的提示已全部展开。请尝试用自己的语言修订解释。");
  return { ...session, pending: undefined, entries: [...session.entries, { id, kind: "hint", stage: "revision", text: session.task.task.hints[level], level: level + 1, createdAt: now }], updatedAt: now };
}
export function validateTask(raw: unknown, expectedUnit: number): Task {
  if (!raw || typeof raw !== "object") throw new EducationError("任务格式不完整。");
  const item = raw as Task;
  const list = (value: unknown, label: string, min: number, max: number) => {
    if (!Array.isArray(value) || value.length < min || value.length > max) throw new EducationError(`${label}数量无效。`);
    return value.map((text) => requiredText(text, label, 1500));
  };
  if (!item.prompts || typeof item.prompts !== "object") throw new EducationError("缺少学习阶段问题。");
  if (!Array.isArray(item.concepts) || item.concepts.length < 1 || item.concepts.length > 8) throw new EducationError("概念卡数量无效。");
  return {
    unitId: expectedUnit, id: TASKS[expectedUnit].id,
    title: requiredText(item.title, "任务标题", 150), caseText: requiredText(item.caseText, "案例", 3000), objective: requiredText(item.objective, "学习目标", 1000),
    prompts: Object.fromEntries(STAGES.map((stage) => [stage.id, requiredText(item.prompts[stage.id], stage.title, 2000)])) as Task["prompts"],
    hints: list(item.hints, "分层提示", 3, 3) as Task["hints"],
    concepts: item.concepts.map((concept) => ({ term: requiredText(concept?.term, "概念名称", 100), text: requiredText(concept?.text, "概念说明", 1500) })),
    criteria: list(item.criteria, "学习标准", 1, 8), source: requiredText(item.source, "材料来源", 2000),
  };
}
export function sessionSummary(session: LearningSession) {
  return { id: session.id, unitId: session.unitId, interventionId: session.interventionId ?? session.task.interventionId, scheduledWeek: session.task.scheduledWeek,
    provider: session.ai?.provider, model: session.ai?.model, stage: session.stage, createdAt: session.createdAt, updatedAt: session.updatedAt,
    hints: session.entries.filter((entry) => entry.kind === "hint").length,
    chats: session.entries.filter((entry) => entry.kind === "chat").length, aiErrors: session.entries.filter((entry) => entry.kind === "ai_error").length, taskVersion: session.task.version };
}
export function redactText(text: string) {
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱已遮盖]").replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, "[手机号已遮盖]");
}
