"use client";

import Link from "next/link";
import { useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updatePassword = async () => {
    if (password.length < 8) {
      setError("Password should be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const client = getSupabaseBrowserClient();
      const { error: updateError } = await client.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setMessage("Password updated. You can now sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div className="container" style={{ padding: "34px 0" }}>
        <section className="card" style={{ maxWidth: 620, margin: "0 auto", padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Set new password</h2>
          <div className="grid" style={{ gap: 10 }}>
            <div>
              <label>New password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label>Confirm password</label>
              <input
                className="input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <div>
              <button className="btn" onClick={updatePassword} disabled={loading}>
                {loading ? "Updating..." : "Update password"}
              </button>
            </div>
          </div>

          {message ? <p style={{ color: "#166534" }}>{message}</p> : null}
          {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

          <p className="muted" style={{ marginBottom: 0 }}>
            Return to <Link href="/auth">sign in</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
