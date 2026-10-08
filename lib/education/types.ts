import type { Stage, Task } from "./course";
export type AISelection = { provider: "deepseek" | "openai"; model: string; thinking: "disabled" | "provider-default" };
export type PublishedTask = { task: Task; version: number; published: boolean; scheduledWeek: number; interventionId?: number; teacherNotes: string; reviewedAt: string; reviewedBy: string };
export type Entry = { id: string; kind: "answer" | "hint" | "chat" | "feedback" | "ai_error"; stage: Stage; text: string; createdAt: string; level?: number; reply?: string; model?: string; provider?: AISelection["provider"]; servedModel?: string; thinking?: AISelection["thinking"]; promptVersion?: string; tokens?: number; inputTokens?: number; outputTokens?: number; latencyMs?: number; requestId?: string; errorCode?: string; authorRole?: string };
export type LearningSession = {
  id: string; ownerId: string; unitId: number; task: PublishedTask; stage: Stage | "complete";
  entries: Entry[]; language: string; createdAt: string; updatedAt: string;
  pending?: { id: string; startedAt: string };
  startRequestId?: string;
  interventionId?: number;
  courseVersion?: string;
  ai?: AISelection;
};
export type CourseSettings = { inviteHash?: string; researchEnabled: boolean; researchProtocol: string; consentNotice: string; noticeVersion: number; updatedAt: string };
export type Consent = { enabled: boolean; noticeVersion: number; updatedAt: string };
export type Stored<T> = { value: T; revision: number };
export type SessionSummary = { id: string; unitId: number; interventionId?: number; scheduledWeek: number; stage: LearningSession["stage"]; createdAt: string; updatedAt: string; hints: number; chats: number; aiErrors: number; learnerCode?: string; taskVersion: number; provider?: AISelection["provider"]; model?: string };
export type Analytics = { rows: SessionSummary[]; total: number; learners: number; completed: number; hints: number; chats: number; aiErrors: number; members?: number; researchEnabled: boolean; protocol: string; truncated: boolean; generatedAt: string; units: {unitId: number; started: number; completed: number}[]; interventions: {id: number; title: string; ready: boolean; started: number; completed: number}[]; records?: unknown[] };
