import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { createClient } from "@supabase/supabase-js";

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

type EventRow = {
  id: string;
  type: EventRecord["type"];
  role: UserRole;
  user_id: string;
  course_id: string;
  week_number: number | null;
  assignment_id: string | null;
  session_id: string | null;
  turn_index: number | null;
  created_at: string;
  payload: Record<string, unknown>;
};

type CourseTemplateRow = {
  course_id: string;
  week_number: number;
  assignment_id: string;
  templates: string[];
  scaffolds: TemplateScaffold[] | null;
  active_template_index: number;
  template_version: number;
  course_goal: string;
  assignment_type: string;
  cultural_context: string;
  updated_at: string;
  updated_by: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __CT_AGENT_STORE__: StoreSchema | undefined;
  // eslint-disable-next-line no-var
  var __CT_AGENT_SUPABASE__: ReturnType<typeof createClient> | undefined;
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

function buildTemplateKey(input: {
  courseId: string;
  weekNumber: number;
  assignmentId: string;
}) {
  return `${input.courseId}::W${input.weekNumber}::${input.assignmentId}`;
}

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function isMemoryStoreMode() {
  return !isSupabaseConfigured() && (process.env.VERCEL === "1" || process.env.STORE_MODE === "memory");
}

function getMemoryStore() {
  if (!globalThis.__CT_AGENT_STORE__) {
    globalThis.__CT_AGENT_STORE__ = cloneStore(emptyStore);
  }
  return globalThis.__CT_AGENT_STORE__;
}

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured.");
  }
  if (!globalThis.__CT_AGENT_SUPABASE__) {
    globalThis.__CT_AGENT_SUPABASE__ = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return globalThis.__CT_AGENT_SUPABASE__;
}

async function ensureStore() {
  if (isMemoryStoreMode() || isSupabaseConfigured()) {
    return;
  }
  if (!fs.existsSync(STORE_DIR)) {
    await fs.promises.mkdir(STORE_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    await fs.promises.writeFile(STORE_FILE, `${JSON.stringify(emptyStore, null, 2)}\n`);
  }
}

function mapEventRow(row: EventRow): EventRecord {
  return {
    id: row.id,
    type: row.type,
    role: row.role,
    userId: row.user_id,
    courseId: row.course_id,
    ...(typeof row.week_number === "number" ? { weekNumber: row.week_number } : {}),
    ...(row.assignment_id ? { assignmentId: row.assignment_id } : {}),
    ...(row.session_id ? { sessionId: row.session_id } : {}),
    ...(typeof row.turn_index === "number" ? { turnIndex: row.turn_index } : {}),
    createdAt: row.created_at,
    payload: row.payload ?? {},
  };
}

function mapCourseTemplateRow(row: CourseTemplateRow): CourseTemplateRecord {
  return {
    courseId: row.course_id,
    weekNumber: row.week_number,
    assignmentId: row.assignment_id,
    templates: row.templates ?? [],
    ...(Array.isArray(row.scaffolds) ? { scaffolds: row.scaffolds } : {}),
    activeTemplateIndex: row.active_template_index,
    templateVersion: row.template_version,
    courseGoal: row.course_goal,
    assignmentType: row.assignment_type,
    culturalContext: row.cultural_context,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function readStore(): Promise<StoreSchema> {
  if (isSupabaseConfigured()) {
    return cloneStore(emptyStore);
  }
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
  if (isSupabaseConfigured()) {
    return;
  }
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

  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin() as any;
    const { data, error } = await client
      .from("events")
      .insert({
        id: event.id,
        type: event.type,
        role: event.role,
        user_id: event.userId,
        course_id: event.courseId,
        week_number: event.weekNumber ?? null,
        assignment_id: event.assignmentId ?? null,
        session_id: event.sessionId ?? null,
        turn_index: event.turnIndex ?? null,
        created_at: event.createdAt,
        payload: event.payload,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to append event in Supabase: ${error.message}`);
    }

    return mapEventRow(data as EventRow);
  }

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
  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin() as any;
    let query = client.from("events").select("*");

    if (filters?.role) query = query.eq("role", filters.role);
    if (filters?.type) query = query.eq("type", filters.type);
    if (filters?.courseId) query = query.eq("course_id", filters.courseId);
    if (typeof filters?.weekNumber === "number") query = query.eq("week_number", filters.weekNumber);
    if (filters?.assignmentId) query = query.eq("assignment_id", filters.assignmentId);

    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) {
      throw new Error(`Failed to list events from Supabase: ${error.message}`);
    }

    return (data as EventRow[]).map(mapEventRow);
  }

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

  if (isSupabaseConfigured()) {
    return withWriteLock(async () => {
      const client = getSupabaseAdmin() as any;
      const { data: existing, error: existingError } = await client
        .from("course_templates")
        .select("template_version")
        .eq("course_id", input.courseId)
        .eq("week_number", input.weekNumber)
        .eq("assignment_id", input.assignmentId)
        .maybeSingle();

      if (existingError) {
        throw new Error(`Failed to query existing template version: ${existingError.message}`);
      }

      const version = (existing?.template_version ?? 0) + 1;
      const payload = {
        course_id: input.courseId,
        week_number: input.weekNumber,
        assignment_id: input.assignmentId,
        templates: input.templates,
        scaffolds: input.scaffolds ?? null,
        active_template_index: normalizedIndex,
        template_version: version,
        course_goal: input.courseGoal,
        assignment_type: input.assignmentType,
        cultural_context: input.culturalContext,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      };

      const { data, error } = await client
        .from("course_templates")
        .upsert(payload, { onConflict: "course_id,week_number,assignment_id" })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to upsert templates in Supabase: ${error.message}`);
      }

      return mapCourseTemplateRow(data as CourseTemplateRow);
    });
  }

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
  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin() as any;
    const { data, error } = await client
      .from("course_templates")
      .select("*")
      .eq("course_id", input.courseId)
      .eq("week_number", input.weekNumber)
      .eq("assignment_id", input.assignmentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load templates from Supabase: ${error.message}`);
    }
    return data ? mapCourseTemplateRow(data as CourseTemplateRow) : null;
  }

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
  if (isSupabaseConfigured()) {
    return withWriteLock(async () => {
      const existing = await getCourseTemplates({
        courseId: input.courseId,
        weekNumber: input.weekNumber,
        assignmentId: input.assignmentId,
      });
      if (!existing || existing.templates.length === 0) {
        return null;
      }

      const normalizedIndex = Math.max(
        0,
        Math.min(input.activeTemplateIndex, existing.templates.length - 1),
      );

      const client = getSupabaseAdmin() as any;
      const { data, error } = await client
        .from("course_templates")
        .update({
          active_template_index: normalizedIndex,
          updated_at: new Date().toISOString(),
          updated_by: input.updatedBy,
        })
        .eq("course_id", input.courseId)
        .eq("week_number", input.weekNumber)
        .eq("assignment_id", input.assignmentId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update active template in Supabase: ${error.message}`);
      }
      return mapCourseTemplateRow(data as CourseTemplateRow);
    });
  }

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
