"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { UserRole } from "@/lib/types";

type Props = {
  expected: UserRole;
  children: React.ReactNode;
};

type GateState = "loading" | "unauthenticated" | "mismatch" | "authorized";

export default function RoleGate({ expected, children }: Props) {
  const [state, setState] = useState<GateState>("loading");
  const [actualRole, setActualRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const client = getSupabaseBrowserClient();
        const { data: sessionData } = await client.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setState("unauthenticated");
          return;
        }

        const res = await fetch("/api/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load profile.");
        }

        const role = data.user?.role as UserRole;
        setActualRole(role);
        if (role !== expected) {
          setState("mismatch");
          return;
        }
        setState("authorized");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load auth state.");
        setState("unauthenticated");
      }
    };

    void load();
  }, [expected]);

  if (state === "loading") {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Checking access...</h2>
        <p className="muted">Validating session and role permissions.</p>
      </div>
    );
  }

  if (state === "unauthenticated") {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Sign in required</h2>
        <p className="muted">You need an authenticated account to access this page.</p>
        <p style={{ marginBottom: 0 }}>
          <Link className="role-card-link" href="/auth">
            Go to sign in / sign up
          </Link>
        </p>
        {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      </div>
    );
  }

  if (state === "mismatch") {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Role mismatch</h2>
        <p className="muted">
          This page requires <b>{expected}</b>. Your account role is <b>{actualRole ?? "unknown"}</b>.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link className="role-card-link" href="/auth">
            Switch account
          </Link>
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
