import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import type {
  CourseTemplateRecord,
  EventRecord,
  TemplateScaffold,
  UserRole,
} from "@/lib/types";

type StoreSchema = {
  events: EventRecord[];
  courseTemplates: Record<string, CourseTemplateRecord>;
};

declare global {
  // eslint-disable-next-line no-var
  var __CT_AGENT_STORE__: StoreSchema | undefined;
}

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "store.json");

let writeQueue: Promise<void> = Promise.resolve();

const emptyStore: StoreSchema = {
  events: [],
  courseTemplates: {},
};

function cloneStore(data: StoreSchema): StoreSchema {
  return {
    events: [...data.events],
    courseTemplates: { ...data.courseTemplates },
  };
}

function isMemoryStoreMode() {
  return process.env.VERCEL === "1" || process.env.STORE_MODE === "memory";
}

function getMemoryStore() {
  if (!globalThis.__CT_AGENT_STORE__) {
    globalThis.__CT_AGENT_STORE__ = cloneStore(emptyStore);
  }
  return globalThis.__CT_AGENT_STORE__;
}

function buildTemplateKey(input: {
  courseId: string;
  weekNumber: number;
  assignmentId: string;
}) {
  return `${input.courseId}::W${input.weekNumber}::${input.assignmentId}`;
}

async function ensureStore() {
  if (isMemoryStoreMode()) {
    return;
  }
  if (!fs.existsSync(STORE_DIR)) {
    await fs.promises.mkdir(STORE_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    await fs.promises.writeFile(STORE_FILE, `${JSON.stringify(emptyStore, null, 2)}\n`);
  }
}

async function readStore(): Promise<StoreSchema> {
  if (isMemoryStoreMode()) {
    return cloneStore(getMemoryStore());
  }
  await ensureStore();
  const raw = await fs.promises.readFile(STORE_FILE, "utf-8");
  const parsed = JSON.parse(raw) as Partial<StoreSchema>;
  return {
    events: Array.isArray(parsed.events) ? parsed.events : [],
    courseTemplates:
      parsed.courseTemplates && typeof parsed.courseTemplates === "object"
        ? parsed.courseTemplates
        : {},
  };
}

async function writeStore(data: StoreSchema) {
  if (isMemoryStoreMode()) {
    globalThis.__CT_AGENT_STORE__ = cloneStore(data);
    return;
  }
  await fs.promises.writeFile(STORE_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

function withWriteLock<T>(work: () => Promise<T>): Promise<T> {
  const task = writeQueue.then(work, work);
  writeQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

export async function appendEvent(input: {
  type: EventRecord["type"];
  role: UserRole;
  userId: string;
  courseId: string;
  weekNumber?: number;
  assignmentId?: string;
  sessionId?: string;
  turnIndex?: number;
  payload?: Record<string, unknown>;
}) {
  const event: EventRecord = {
    id: crypto.randomUUID(),
    type: input.type,
    role: input.role,
    userId: input.userId,
    courseId: input.courseId,
    ...(typeof input.weekNumber === "number" ? { weekNumber: input.weekNumber } : {}),
    ...(input.assignmentId ? { assignmentId: input.assignmentId } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(typeof input.turnIndex === "number" ? { turnIndex: input.turnIndex } : {}),
    createdAt: new Date().toISOString(),
    payload: input.payload ?? {},
  };

  await withWriteLock(async () => {
    const store = await readStore();
    store.events.push(event);
    await writeStore(store);
  });

  return event;
}

export async function listEvents(filters?: {
  role?: UserRole;
  type?: EventRecord["type"];
  courseId?: string;
  weekNumber?: number;
  assignmentId?: string;
}) {
  const store = await readStore();

  return store.events.filter((event) => {
    if (filters?.role && event.role !== filters.role) return false;
    if (filters?.type && event.type !== filters.type) return false;
    if (filters?.courseId && event.courseId !== filters.courseId) return false;
    if (typeof filters?.weekNumber === "number" && event.weekNumber !== filters.weekNumber) return false;
    if (filters?.assignmentId && event.assignmentId !== filters.assignmentId) return false;
    return true;
  });
}

export async function saveCourseTemplates(input: {
  courseId: string;
  weekNumber: number;
  assignmentId: string;
  templates: string[];
  scaffolds?: TemplateScaffold[];
  activeTemplateIndex: number;
  courseGoal: string;
  assignmentType: string;
  culturalContext: string;
  updatedBy: string;
}) {
  const normalizedIndex = Math.max(
    0,
    Math.min(input.activeTemplateIndex, Math.max(input.templates.length - 1, 0)),
  );

  const key = buildTemplateKey({
    courseId: input.courseId,
    weekNumber: input.weekNumber,
    assignmentId: input.assignmentId,
  });

  let record!: CourseTemplateRecord;

  await withWriteLock(async () => {
    const store = await readStore();
    const previous = store.courseTemplates[key];
    record = {
      courseId: input.courseId,
      weekNumber: input.weekNumber,
      assignmentId: input.assignmentId,
      templates: input.templates,
      ...(input.scaffolds ? { scaffolds: input.scaffolds } : {}),
      activeTemplateIndex: normalizedIndex,
      templateVersion: (previous?.templateVersion ?? 0) + 1,
      courseGoal: input.courseGoal,
      assignmentType: input.assignmentType,
      culturalContext: input.culturalContext,
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy,
    };
    store.courseTemplates[key] = record;
    await writeStore(store);
  });

  return record;
}

export async function getCourseTemplates(input: {
  courseId: string;
  weekNumber: number;
  assignmentId: string;
}) {
  const store = await readStore();
  const key = buildTemplateKey(input);
  return store.courseTemplates[key] ?? null;
}

export async function setCourseTemplateActiveIndex(input: {
  courseId: string;
  weekNumber: number;
  assignmentId: string;
  activeTemplateIndex: number;
  updatedBy: string;
}): Promise<CourseTemplateRecord | null> {
  let nextRecord: CourseTemplateRecord | null = null;

  await withWriteLock(async () => {
    const store = await readStore();
    const key = buildTemplateKey({
      courseId: input.courseId,
      weekNumber: input.weekNumber,
      assignmentId: input.assignmentId,
    });
    const existing = store.courseTemplates[key];
    if (!existing || existing.templates.length === 0) {
      return;
    }
    const normalizedIndex = Math.max(
      0,
      Math.min(input.activeTemplateIndex, existing.templates.length - 1),
    );
    nextRecord = {
      ...existing,
      activeTemplateIndex: normalizedIndex,
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy,
    };
    store.courseTemplates[key] = nextRecord;
    await writeStore(store);
  });

  return nextRecord;
}
