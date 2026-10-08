"use client";
import { useCallback, useEffect, useState } from "react";
import { getConfiguredSupabaseClient } from "@/lib/supabase-browser";
import type { AISelection, Consent, CourseSettings, PublishedTask, SessionSummary } from "@/lib/education/types";
import type { UserRole } from "@/lib/types";
export type Overview = {
  user: { id: string; role: UserRole; learnerCode: string }; member: boolean; configs: PublishedTask[];
  sessions: SessionSummary[]; settings: Omit<CourseSettings, "inviteHash"> & { inviteEnabled: boolean };
  consent: Consent; aiEnabled: boolean; ai: {provider: AISelection["provider"] | null; model: string | null; configured: boolean; configurationError: boolean}; aiAvailability: Record<AISelection["provider"], boolean>; classroomEnabled: boolean; truncated: boolean;
};
export async function educationApi<T = Record<string, unknown>>(query = "", body?: Record<string, unknown>): Promise<T> {
  const client = await getConfiguredSupabaseClient();
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error("请先登录课程账号。");
  const response = await fetch(`/api/education${query}`, { method: body ? "POST" : "GET", cache: "no-store", headers: { Authorization: `Bearer ${data.session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "操作失败，请稍后重试。");
  return result as T;
}
export function useEducation(enabled = true) {
  const [data, setData] = useState<Overview | null>(null), [loading, setLoading] = useState(enabled), [error, setError] = useState("");
  const refresh = useCallback(async () => { if (!enabled) return; setLoading(true); setError(""); try { setData(await educationApi<Overview>()); } catch (err) { setError(err instanceof Error ? err.message : "课程服务暂时不可用。"); } finally { setLoading(false); } }, [enabled]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}
export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
