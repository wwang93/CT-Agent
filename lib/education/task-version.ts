import type { LearningSession, PublishedTask } from "./types";

// Only activity 2 adopts a uniform latest-version task. Activity 1 keeps its
// original continuation/quota semantics; no stored histories are migrated.
export function usesLatestTask(unitId: number) { return unitId === 10; }
export function attemptScopeKey(ownerId: string, unitId: number, taskVersion: number) {
  return `${ownerId}:${unitId}${usesLatestTask(unitId) ? `:v${taskVersion}` : ""}`;
}
export function isInTaskScope(session: LearningSession, unitId: number, taskVersion?: number) {
  return session.unitId === unitId && (!usesLatestTask(unitId) || session.task.version === taskVersion);
}
export function taskVersionView(session: LearningSession, config?: PublishedTask): LearningSession {
  const { archivedForTaskVersion: _archived, latestTaskPublished: _published, ...source } = session;
  if (!usesLatestTask(session.unitId)) return source;
  return { ...source, latestTaskPublished: config?.published === true,
    ...(config && config.version !== session.task.version ? { archivedForTaskVersion: config.version } : {}) };
}
