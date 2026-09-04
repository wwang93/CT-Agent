import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { COURSE } from "./course";
import { EducationError } from "./engine";
import type { Stored } from "./types";

// V1 reuses the existing Postgres table. Reserved edu:* keys cannot be accessed
// through legacy template endpoints. Each session is one CAS-protected aggregate:
// the visible record and its interaction trace commit atomically together.
function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new EducationError("教学数据库尚未配置。可先预览课程样板，正式学习记录不会保存在临时内存中。", 503);
  return getSupabaseAdminClient() as any;
}
export async function readRecord<T>(key: string): Promise<Stored<T> | null> {
  const { data, error } = await db().from("course_templates").select("scaffolds,template_version").eq("course_id", COURSE.id).eq("week_number", 0).eq("assignment_id", `edu:${key}`).maybeSingle();
  if (error) throw new EducationError("读取课程数据失败，请稍后重试。", 503);
  return data ? { value: data.scaffolds[0] as T, revision: data.template_version } : null;
}
export async function writeRecord<T>(key: string, value: T, owner: string, expectedRevision: number): Promise<Stored<T>> {
  const base = { scaffolds: [value], template_version: expectedRevision + 1, updated_at: new Date().toISOString(), updated_by: owner };
  const client = db();
  const result = expectedRevision === 0
    ? await client.from("course_templates").insert({ ...base, course_id: COURSE.id, week_number: 0, assignment_id: `edu:${key}`, templates: [], active_template_index: 0, course_goal: "教育心理学课程学习", assignment_type: "education-v1", cultural_context: "语言专业学习情境" }).select("template_version").single()
    : await client.from("course_templates").update(base).eq("course_id", COURSE.id).eq("week_number", 0).eq("assignment_id", `edu:${key}`).eq("template_version", expectedRevision).select("template_version").maybeSingle();
  if (result.error?.code === "23505" || (!result.error && !result.data)) throw new EducationError("记录已被另一请求更新。请刷新后继续；已提交内容不会重复保存。", 409);
  if (result.error) throw new EducationError("保存失败，你的输入仍保留在页面中，请重试。", 503);
  return { value, revision: expectedRevision + 1 };
}
export async function listRecords<T>(prefix: string, owner?: string): Promise<{ records: T[]; truncated: boolean }> {
  const records: T[] = [];
  const pageSize = 200, limit = 2400;
  for (let start = 0; start < limit; start += pageSize) {
    let query = db().from("course_templates").select("scaffolds").eq("course_id", COURSE.id).eq("week_number", 0).like("assignment_id", `edu:${prefix}%`).order("assignment_id").range(start, start + pageSize - 1);
    if (owner) query = query.eq("updated_by", owner);
    const { data, error } = await query;
    if (error) throw new EducationError("读取班级记录失败，请稍后重试。", 503);
    records.push(...data.map((row: { scaffolds: T[] }) => row.scaffolds[0]));
    if (data.length < pageSize) return { records, truncated: false };
  }
  return { records, truncated: true };
}
