import "server-only";
import crypto from "node:crypto";
import { EducationError } from "./engine";
import { readRecord, writeRecord } from "./store";

type Lease = { id: string; owner: string; expiresAt: number };
type Budget = { day: string; used: number };
export type AIPermit = { slot: number; leaseId: string };
export class AICapacityError extends EducationError {
  constructor(message: string, public retryAfter: number) { super(message, 429); }
}
function boundedSetting(name: string, fallback: number, max: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > max) throw new EducationError(`${name} 配置无效，请联系管理员。`, 503);
  return Number(raw);
}
export function aiCapacityLimits() {
  return { concurrent: boundedSetting("EDU_AI_MAX_CONCURRENT", 20, 32), dailyRequests: boundedSetting("EDU_AI_DAILY_REQUEST_LIMIT", 1000, 10000) };
}
// Classroom budgets reset at 00:00 China Standard Time, not the host timezone.
const budgetDay = (now: number) => new Date(now + 8 * 3600_000).toISOString().slice(0, 10);
async function consumeBudget(owner: string, now: number, max: number) {
  const day = budgetDay(now);
  for (let attempt = 0; attempt < 32; attempt++) {
    const previous = await readRecord<Budget>("ai-budget:current");
    const used = previous?.value.day === day ? previous.value.used : 0;
    if (used >= max) {
      const nextDay = Date.parse(`${day}T00:00:00+08:00`) + 86400_000;
      throw new AICapacityError("本班今日 AI 请求额度已用完。你的问题仍保留，可使用教师提示或联系教师。", Math.max(1, Math.ceil((nextDay - now) / 1000)));
    }
    try { await writeRecord("ai-budget:current", { day, used: used + 1 }, owner, previous?.revision ?? 0); return; }
    catch (error) {
      if (!(error instanceof EducationError) || error.status !== 409) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(5 + attempt * 2, 40)));
    }
  }
  throw new AICapacityError("课堂请求较多，请稍后再试。你的问题尚未发送给模型。", 15);
}
export async function acquireAIPermit(owner: string, now = Date.now()): Promise<AIPermit> {
  const limits = aiCapacityLimits(), start = crypto.randomInt(limits.concurrent);
  // Bounded probes prevent rejected requests from flooding the database.
  for (let offset = 0; offset < Math.min(4, limits.concurrent); offset++) {
    const slot = (start + offset) % limits.concurrent, key = `ai-slot:${slot}`;
    const previous = await readRecord<Lease>(key);
    if (previous && previous.value.expiresAt > now) continue;
    const leaseId = crypto.randomUUID();
    try { await writeRecord(key, { id: leaseId, owner, expiresAt: now + 90_000 }, owner, previous?.revision ?? 0); }
    catch (error) { if (error instanceof EducationError && error.status === 409) continue; throw error; }
    const permit = { slot, leaseId };
    try { await consumeBudget(owner, now, limits.dailyRequests); return permit; }
    catch (error) { await releaseAIPermit(permit); throw error; }
  }
  throw new AICapacityError("课堂 AI 正在处理其他同学的问题。请 15 秒后重试；问题保留，尚未发送给模型，也不占本次答疑轮数。", 15);
}
export async function releaseAIPermit(permit: AIPermit) {
  try {
    const key = `ai-slot:${permit.slot}`, previous = await readRecord<Lease>(key);
    // A late completion must not release a newer request's lease.
    if (previous?.value.id === permit.leaseId) await writeRecord(key, { ...previous.value, expiresAt: 0 }, previous.value.owner, previous.revision);
  } catch { /* A failed release expires automatically; never claim an AI answer failed after saving it. */ }
}
export async function aiCapacityStatus(now = Date.now()) {
  const limits = aiCapacityLimits(), budget = await readRecord<Budget>("ai-budget:current");
  return { ...limits, usedToday: budget?.value.day === budgetDay(now) ? budget.value.used : 0, day: budgetDay(now), timezone: "Asia/Shanghai" };
}
