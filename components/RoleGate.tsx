"use client";

import { useEffect, useState } from "react";

import { ROLE_QUERY_KEY, ROLE_STORAGE_KEY, parseRole } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

type Props = {
  expected: UserRole;
  children: React.ReactNode;
};

export default function RoleGate({ expected, children }: Props) {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = parseRole(url.searchParams.get(ROLE_QUERY_KEY));
    if (fromUrl) {
      sessionStorage.setItem(ROLE_STORAGE_KEY, fromUrl);
      setRole(fromUrl);
      return;
    }
    const fromStorage = parseRole(sessionStorage.getItem(ROLE_STORAGE_KEY));
    setRole(fromStorage);
  }, []);

  if (!role) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Mock role required</h2>
        <p className="muted">Open this page with one of these links first:</p>
        <ul>
          <li><a href={`/?${ROLE_QUERY_KEY}=student`}>Student mode</a></li>
          <li><a href={`/?${ROLE_QUERY_KEY}=instructor`}>Instructor mode</a></li>
          <li><a href={`/?${ROLE_QUERY_KEY}=researcher`}>Researcher mode</a></li>
        </ul>
      </div>
    );
  }

  if (role !== expected) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Role mismatch</h2>
        <p className="muted">This page requires <b>{expected}</b> mode. Current mode is <b>{role}</b>.</p>
      </div>
    );
  }

  return <>{children}</>;
}
