"use client";

import Link from "next/link";

type Props = {
  title: string;
};

export default function NavBar({ title }: Props) {
  return (
    <header className="site-header">
      <div className="container top-row">
        <Link href="/" className="wordmark">
          CT-<span>AGENT</span>
        </Link>
        <span className="pill">V1.3</span>
        <div className="top-nav">
          <Link href="/student">Student Coach</Link>
          <Link href="/instructor">Instructor Copilot</Link>
          <Link href="/research">Research Analytics</Link>
        </div>
      </div>
      <div className="container">
        <p className="subtitle">{title}</p>
      </div>
    </header>
  );
}
