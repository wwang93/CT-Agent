import type { Stage, Task } from "./course";
export type PublishedTask = { task: Task; version: number; published: boolean; scheduledWeek: number; teacherNotes: string; reviewedAt: string; reviewedBy: string };
export type Entry = { id: string; kind: "answer" | "hint" | "chat" | "feedback"; stage: Stage; text: string; createdAt: string; level?: number; reply?: string; model?: string; promptVersion?: string; tokens?: number; authorRole?: string };
export type LearningSession = {
  id: string; ownerId: string; unitId: number; task: PublishedTask; stage: Stage | "complete";
  entries: Entry[]; language: string; createdAt: string; updatedAt: string;
  pending?: { id: string; startedAt: string };
  startRequestId?: string;
};
export type CourseSettings = { inviteHash?: string; researchEnabled: boolean; researchProtocol: string; consentNotice: string; noticeVersion: number; updatedAt: string };
export type Consent = { enabled: boolean; noticeVersion: number; updatedAt: string };
export type Stored<T> = { value: T; revision: number };
export type SessionSummary = { id: string; unitId: number; stage: LearningSession["stage"]; createdAt: string; updatedAt: string; hints: number; chats: number; learnerCode?: string; taskVersion: number };
export type Analytics = { rows: SessionSummary[]; total: number; learners: number; completed: number; hints: number; chats: number; members?: number; researchEnabled: boolean; protocol: string; truncated: boolean; generatedAt: string; units: {unitId: number; started: number; completed: number}[]; records?: unknown[] };
