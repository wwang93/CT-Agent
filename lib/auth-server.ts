import { NextResponse } from "next/server";

import { parseRole } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types";

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
    throw new AuthError(`Failed to load profile: ${existingError.message}`, 500);
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
    throw new AuthError(`Failed to create profile: ${createError.message}`, 500);
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

  const metadataRole = parseRole(String(data.user.user_metadata?.role ?? "")) ?? "student";
  const profile = await ensureProfile(data.user.id, metadataRole);

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
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unauthorized.";
  return NextResponse.json({ error: message }, { status: 500 });
}
