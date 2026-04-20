"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { roleLandingPath } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { UserRole } from "@/lib/types";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    const run = async () => {
      try {
        const client = getSupabaseBrowserClient();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!data.session?.access_token) {
          setMessage("No active session. Please sign in.");
          return;
        }

        const res = await fetch("/api/me", {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Failed to load profile.");

        router.replace(roleLandingPath(payload.user.role as UserRole));
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Authentication callback failed.");
      }
    };

    void run();
  }, [router]);

  return (
    <main>
      <div className="container" style={{ padding: "34px 0" }}>
        <section className="card" style={{ maxWidth: 620, margin: "0 auto", padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Auth callback</h2>
          <p className="muted" style={{ marginBottom: 0 }}>{message}</p>
        </section>
      </div>
    </main>
  );
}
