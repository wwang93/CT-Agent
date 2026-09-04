"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let runtimeConfig: { url: string; key: string } | null = null;

export async function getConfiguredSupabaseClient() {
  if (!browserClient && !runtimeConfig) {
    const response = await fetch("/api/education/status", { cache: "no-store" });
    if (!response.ok) throw new Error("课程配置暂时无法读取，请稍后重试。");
    const data = await response.json();
    if (!data.authUrl || !data.authKey || !data.databaseConfigured) throw new Error("课程账号与教学数据库尚未接通。现在可以预览课程地图和脚手架；正式学习需完成部署配置。");
    runtimeConfig = { url: data.authUrl, key: data.authKey };
  }
  return getSupabaseBrowserClient();
}

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || runtimeConfig?.url;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || runtimeConfig?.key;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  if (!browserClient) {
    browserClient = createClient(url, key);
  }

  return browserClient;
}
