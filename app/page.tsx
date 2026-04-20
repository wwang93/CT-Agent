import Link from "next/link";

import NavBar from "@/components/NavBar";

export default function HomePage() {
  return (
    <main>
      <NavBar title="Design-based research teaching assistant prototype" />
      <div className="container" style={{ padding: "26px 0 36px" }}>
        <section className="hero" style={{ marginBottom: 18 }}>
          <h1>
            CT-<span>AGENT</span> V1.4
          </h1>
          <p>
            UT-themed interface plus week-aligned scaffold workflow: instructors publish templates by week and
            assignment, students inherit matching guidance, and researchers monitor week-level interaction trends.
          </p>
        </section>

        <section className="grid grid-3">
          <article className="card" style={{ padding: 16 }}>
            <h3 className="role-card-title">Student Coach</h3>
            <p className="muted">High-order questioning without giving away answers.</p>
            <p><Link className="role-card-link" href="/student">Open as student</Link></p>
          </article>
          <article className="card" style={{ padding: 16 }}>
            <h3 className="role-card-title">Instructor Copilot</h3>
            <p className="muted">Generate culturally tailored prompt sets for assignments.</p>
            <p><Link className="role-card-link" href="/instructor">Open as instructor</Link></p>
          </article>
          <article className="card" style={{ padding: 16 }}>
            <h3 className="role-card-title">Research Analytics</h3>
            <p className="muted">View behavioral indicators aligned with your mixed-methods study.</p>
            <p><Link className="role-card-link" href="/research">Open as researcher</Link></p>
          </article>
        </section>
        <section style={{ marginTop: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            Need access? <Link className="role-card-link" href="/auth">Sign in or create an account</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
