"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  title: string;
};

export default function NavBar({ title }: Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    try {
      const client = getSupabaseBrowserClient();
      await client.auth.signOut();
      router.push("/auth");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="site-header">
      <div className="container top-row">
        <Link href="/" className="wordmark">
          CT-<span>AGENT</span>
        </Link>
        <span className="pill">V1.4</span>
        <div className="top-nav">
          <Link href="/student">Student Coach</Link>
          <Link href="/instructor">Instructor Copilot</Link>
          <Link href="/research">Research Analytics</Link>
          <Link href="/auth">Auth</Link>
          <button
            className="btn btn-secondary"
            style={{ padding: "6px 10px", fontSize: 12 }}
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
      <div className="container">
        <p className="subtitle">{title}</p>
      </div>
    </header>
  );
}
