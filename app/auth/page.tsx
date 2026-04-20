"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { roleLandingPath } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { UserRole } from "@/lib/types";

const defaultRole: UserRole = "student";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const client = getSupabaseBrowserClient();
      const { data } = await client.auth.getSession();
      if (!data.session?.access_token) return;

      const res = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });
      const payload = await res.json();
      if (res.ok && payload.user?.role) {
        router.replace(roleLandingPath(payload.user.role as UserRole));
      }
    };
    void load();
  }, [router]);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const client = getSupabaseBrowserClient();
      const { data, error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      const token = data.session?.access_token;
      if (!token) {
        setMessage("Sign-in succeeded. Please wait for session sync.");
        return;
      }

      const res = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to resolve user role.");
      }
      router.replace(roleLandingPath(payload.user.role as UserRole));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
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
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: signUpError } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            role,
          },
        },
      });
      if (signUpError) throw signUpError;

      setMessage(
        "Registration submitted. Check your email for verification, then sign in.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const client = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetError) throw resetError;
      setMessage("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div className="container" style={{ padding: "32px 0" }}>
        <section className="card" style={{ padding: 22, maxWidth: 640, margin: "0 auto" }}>
          <h1 className="card-headline">CT-AGENT Access</h1>
          <p className="muted">
            Register, verify email, sign in, and access the role-specific workspace.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button className="btn btn-secondary" onClick={() => setMode("signin")}>Sign in</button>
            <button className="btn btn-secondary" onClick={() => setMode("signup")}>Sign up</button>
            <button className="btn btn-secondary" onClick={() => setMode("forgot")}>Forgot password</button>
          </div>

          <div className="grid" style={{ gap: 10 }}>
            <div>
              <label>Email</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            {mode !== "forgot" ? (
              <div>
                <label>Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : null}

            {mode === "signup" ? (
              <>
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
                  <label>Role</label>
                  <select
                    className="select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                  >
                    <option value="student">Student</option>
                    <option value="instructor">Instructor</option>
                    <option value="researcher">Researcher</option>
                  </select>
                </div>
              </>
            ) : null}

            <div style={{ display: "flex", gap: 8 }}>
              {mode === "signin" ? (
                <button className="btn" onClick={handleSignIn} disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              ) : null}
              {mode === "signup" ? (
                <button className="btn" onClick={handleSignUp} disabled={loading}>
                  {loading ? "Creating account..." : "Create account"}
                </button>
              ) : null}
              {mode === "forgot" ? (
                <button className="btn" onClick={handleForgot} disabled={loading}>
                  {loading ? "Sending..." : "Send reset email"}
                </button>
              ) : null}
            </div>
          </div>

          {message ? <p style={{ color: "#166534" }}>{message}</p> : null}
          {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

          <p className="muted" style={{ marginBottom: 0 }}>
            After sign-in, routing is automatic by role. You can also return to <Link href="/">home</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
