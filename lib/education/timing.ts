import { STAGES, type Stage } from "./course";
import type { BrowserObservation, CourseSettings, LearningSession, SessionTiming, StageTiming } from "./types";

export const DEFAULT_STAGE_SECONDS: Record<Stage, number> = { initial: 360, revision: 600, transfer: 480, reflection: 240 };
export const MAX_ATTEMPTS = 2;
export function newTiming(now: string, policy?: CourseSettings["timingPolicy"]): SessionTiming {
  return { policyVersion: "soft-timer-v1", configurationVersion: policy?.version ?? 0, suggestedSeconds: { ...(policy?.suggestedSeconds ?? DEFAULT_STAGE_SECONDS) }, stages: { initial: { startedAt: now } } };
}
export function browserObservation(raw: unknown, elapsedMs?: number): BrowserObservation | undefined {
  if (!raw || typeof raw !== "object" || elapsedMs === undefined) return;
  const r = raw as Record<string, unknown>;
  if (![r.observedMs, r.hiddenMs, r.interruptions].every(n => typeof n === "number" && Number.isSafeInteger(n) && n >= 0)) return;
  const observedMs = Math.min(Number(r.observedMs), elapsedMs);
  return { observedMs, hiddenMs: Math.min(Number(r.hiddenMs), observedMs), interruptions: Math.min(Number(r.interruptions), 100000), source: "browser-reported-partial" };
}
export function endStage(timing: SessionTiming | undefined, stage: Stage, now: string, rawObservation?: unknown, submitted = true): StageTiming {
  const previous = timing?.stages[stage];
  const elapsedMs = previous?.startedAt ? Math.max(0, Date.parse(now) - Date.parse(previous.startedAt)) : undefined;
  return { ...previous, ...(submitted ? { submittedAt: now } : { endedAt: now }),
    ...(elapsedMs === undefined ? { missingStart: true } : { elapsedMs, overrunMs: Math.max(0, elapsedMs - (timing?.suggestedSeconds[stage] ?? DEFAULT_STAGE_SECONDS[stage]) * 1000) }),
    observation: browserObservation(rawObservation, elapsedMs) };
}
export function finishStage(session: LearningSession, now: string, rawObservation?: unknown): SessionTiming {
  const stage = session.stage as Stage;
  // A legacy stage has no measured start. Begin only the NEXT stage accurately.
  const timing = session.timing ?? { ...newTiming(now), stages: {} };
  const stages = { ...timing.stages, [stage]: endStage(timing, stage, now, rawObservation) };
  const next = STAGES[STAGES.findIndex(item => item.id === stage) + 1]?.id;
  if (next) stages[next] = { startedAt: now };
  return { ...timing, stages };
}
export function attemptViews(sessions: LearningSession[]): LearningSession[] {
  const sorted = [...sessions].sort((a,b) => a.restartOf === b.id ? 1 : b.restartOf === a.id ? -1 : a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const counts = new Map<string, number>();
  const replacements = new Map(sorted.filter(s => s.restartOf).map(s => [s.restartOf!, s]));
  return sorted.map(s => {
    const key = `${s.ownerId}:${s.unitId}`, n = (counts.get(key) ?? 0) + 1; counts.set(key,n);
    const replacement = replacements.get(s.id);
    const interruptedTiming = replacement?.restartSnapshot?.stageTiming;
    return { ...s, attemptNumber: n, ...(replacement ? { supersededBy: replacement.id, supersededAt: replacement.createdAt, savedRestartDraft: replacement.restartSnapshot,
      ...(s.timing && s.stage !== "complete" && interruptedTiming ? { timing: { ...s.timing, stages: { ...s.timing.stages, [s.stage]: interruptedTiming } } } : {}) } : {}) };
  });
}
export function timingTotals(session: LearningSession) {
  const stages = Object.values(session.timing?.stages ?? {});
  const measured = stages.filter(s => s.elapsedMs !== undefined);
  return { timedElapsedMs: measured.length ? measured.reduce((sum,s) => sum + s.elapsedMs!, 0) : undefined,
    timingCoverage: !measured.length ? "none" as const : measured.length === 4 ? "full" as const : "partial" as const };
}
export function durationLabel(ms: number | undefined): string {
  if (ms === undefined) return "未记录";
  const seconds = Math.floor(Math.max(0,ms) / 1000), minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
}
