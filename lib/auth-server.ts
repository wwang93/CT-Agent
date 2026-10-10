import { NextResponse } from "next/server";

import { parseRole } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types";
import { assertLearningSession } from "@/lib/education/learning-accounts";
import { EducationError } from "@/lib/education/engine";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

function extractBearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  if (!value.toLowerCase().startsWith("bearer ")) return "";
  return value.slice(7).trim();
}

async function ensureProfile(userId: string, fallbackRole: UserRole) {
  const client = getSupabaseAdminClient() as any;
  const { data: existing, error: existingError } = await client
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new AuthError("无法核验账号权限，请稍后重试。", 503);
  }

  if (existing?.role) {
    const role = parseRole(existing.role);
    if (role) {
      return {
        userId,
        role,
      };
    }
  }

  const { data: created, error: createError } = await client
    .from("profiles")
    .upsert({
      user_id: userId,
      role: fallbackRole,
    })
    .select("user_id, role")
    .single();

  if (createError) {
    throw new AuthError("无法完成账号权限登记，请联系教师。", 503);
  }

  const role = parseRole(created?.role) ?? fallbackRole;
  return {
    userId,
    role,
  };
}

export async function requireAuthenticatedUser(request: Request) {
  const token = extractBearerToken(request);
  if (!token) {
    throw new AuthError("Missing bearer token.", 401);
  }

  const client = getSupabaseAdminClient() as any;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    throw new AuthError("Invalid or expired token.", 401);
  }

  let learningIdentity: Awaited<ReturnType<typeof assertLearningSession>>;
  try { learningIdentity = await assertLearningSession(data.user.id, data.user.app_metadata ?? {}, token); }
  catch (error) { if (error instanceof EducationError) throw new AuthError(error.message, error.status); throw error; }

  // User-editable signup metadata must never grant staff privileges.
  const profile = await ensureProfile(data.user.id, "student");
  if (learningIdentity && profile.role !== learningIdentity.role) throw new AuthError("ID 权限与预设身份不一致，操作已停止。", 403);

  return {
    token,
    user: data.user,
    role: profile.role,
    userId: profile.userId,
    email: data.user.email ?? "",
  };
}

export function ensureRole(actualRole: UserRole, allowed: UserRole[]) {
  if (!allowed.includes(actualRole)) {
    throw new AuthError("Insufficient role permissions.", 403);
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json({ error: "身份验证暂时不可用，请稍后重试。" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
}
