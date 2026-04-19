"use client";

import { useEffect, useMemo, useState } from "react";

import { evaluateTemplateQuality } from "@/lib/template-quality";
import type { TemplateScaffold } from "@/lib/types";

const DEMO_USER = "instructor-demo-001";

type CourseRecord = {
  templates: string[];
  scaffolds?: TemplateScaffold[];
  activeTemplateIndex: number;
  updatedAt?: string;
};

export default function InstructorCopilot() {
  const [courseId, setCourseId] = useState("RME-600");
  const [weekNumber, setWeekNumber] = useState("4");
  const [assignmentId, setAssignmentId] = useState("weekly-reflection-memo");
  const [goal, setGoal] = useState("Students critique validity threats in mixed-methods studies.");
  const [assignmentType, setAssignmentType] = useState("Weekly reflection memo");
  const [context, setContext] = useState("Include examples with community-based research in Tennessee.");
  const [weekFocus, setWeekFocus] = useState("Week 4: Validity and integration threats");
  const [templates, setTemplates] = useState<string[]>([]);
  const [scaffolds, setScaffolds] = useState<TemplateScaffold[]>([]);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCourseTemplate = async () => {
    const trimmedCourse = courseId.trim();
    const trimmedAssignment = assignmentId.trim();
    const parsedWeek = Number(weekNumber);
    if (!trimmedCourse || !trimmedAssignment || !Number.isFinite(parsedWeek)) return;

    try {
      const query = new URLSearchParams({
        courseId: trimmedCourse,
        weekNumber: String(parsedWeek),
        assignmentId: trimmedAssignment,
      });
      const res = await fetch(`/api/templates?${query.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load templates.");
      if (!data.record) {
        setTemplates([]);
        setScaffolds([]);
        setActiveTemplateIndex(0);
        setPublishedAt(null);
        return;
      }

      const record = data.record as CourseRecord;
      setTemplates(record.templates ?? []);
      setScaffolds(record.scaffolds ?? []);
      setActiveTemplateIndex(record.activeTemplateIndex ?? 0);
      setPublishedAt(record.updatedAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates.");
    }
  };

  const generate = async () => {
    const parsedWeek = Number(weekNumber);
    if (!Number.isFinite(parsedWeek) || !assignmentId.trim()) {
      setError("Week number and assignment ID are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEMO_USER,
          courseId,
          weekNumber: parsedWeek,
          assignmentId: assignmentId.trim(),
          courseGoal: `${goal} | ${weekFocus}`,
          assignmentType,
          culturalContext: context,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate templates.");
      setTemplates(data.templates ?? []);
      setScaffolds(data.scaffolds ?? []);
      setActiveTemplateIndex(data.record?.activeTemplateIndex ?? 0);
      setPublishedAt(data.record?.updatedAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const publishActiveTemplate = async (index: number) => {
    const parsedWeek = Number(weekNumber);
    if (!Number.isFinite(parsedWeek) || !assignmentId.trim()) {
      setError("Week number and assignment ID are required.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          weekNumber: parsedWeek,
          assignmentId: assignmentId.trim(),
          userId: DEMO_USER,
          activeTemplateIndex: index,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to publish active template.");
      setActiveTemplateIndex(data.record?.activeTemplateIndex ?? index);
      setPublishedAt(data.record?.updatedAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    void loadCourseTemplate();
  }, [courseId, weekNumber, assignmentId]);

  const activeScaffold = useMemo(
    () => scaffolds[activeTemplateIndex] ?? null,
    [scaffolds, activeTemplateIndex],
  );
  const activeChecks = activeScaffold ? evaluateTemplateQuality(activeScaffold) : [];
  const checkPassCount = activeChecks.filter((item) => item.passed).length;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <section className="card" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Prompt design studio (V1.2)</h3>
        <p className="muted">
          Generate structured teaching scaffolds with explicit HOT moves, evidence rules, and output contracts.
        </p>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>Course ID</label>
            <input className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)} />
          </div>
          <div>
            <label>Week number</label>
            <input className="input" value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} />
          </div>
          <div>
            <label>Assignment ID</label>
            <input className="input" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} />
          </div>
          <div>
            <label>Assignment type</label>
            <input className="input" value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Week focus</label>
            <input className="input" value={weekFocus} onChange={(e) => setWeekFocus(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Course goal</label>
            <textarea className="textarea" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Cultural context lens</label>
            <textarea className="textarea" value={context} onChange={(e) => setContext(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={generate} disabled={loading}>
            {loading ? "Generating..." : "Generate 3 structured templates"}
          </button>
          <button
            className="btn btn-secondary"
            style={{ marginLeft: 8 }}
            onClick={() => void loadCourseTemplate()}
            disabled={loading || publishing}
          >
            Reload Course Templates
          </button>
        </div>
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        {publishedAt ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Current student-injected template last updated: {new Date(publishedAt).toLocaleString()}
          </p>
        ) : null}
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Generated templates</h3>
        {templates.length === 0 ? (
          <p className="muted">No templates yet.</p>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {templates.map((template, index) => {
              const scaffold = scaffolds[index] ?? null;
              const checks = scaffold ? evaluateTemplateQuality(scaffold) : [];
              const passed = checks.filter((item) => item.passed).length;

              return (
                <div key={`${template.slice(0, 20)}-${index}`} className="message message-assistant">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <strong>{scaffold?.label ?? `Template ${index + 1}`}</strong>
                    <button
                      className="btn btn-secondary"
                      disabled={publishing || activeTemplateIndex === index}
                      onClick={() => publishActiveTemplate(index)}
                    >
                      {activeTemplateIndex === index ? "Active for students" : "Set active for students"}
                    </button>
                  </div>

                  {scaffold ? (
                    <div className="grid" style={{ gap: 8 }}>
                      <div><b>Intensity:</b> {scaffold.intensity}</div>
                      <div><b>Task frame:</b> {scaffold.taskFrame}</div>
                      <div><b>Reasoning moves:</b> {scaffold.reasoningMoves.join(" | ")}</div>
                      <div><b>Evidence rules:</b> {scaffold.evidenceRules.join(" | ")}</div>
                      <div><b>Output contract:</b> {scaffold.outputContract.join(" | ")}</div>
                      <div><b>HOT dimensions:</b> {scaffold.hotDimensions.join(", ")}</div>
                      <div><b>Adequacy check:</b> {passed}/{checks.length} criteria passed</div>
                    </div>
                  ) : (
                    <div>{template}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Template adequacy checker (active template)</h3>
        {!activeScaffold ? (
          <p className="muted">Select or generate templates to view adequacy checks.</p>
        ) : (
          <div className="grid" style={{ gap: 8 }}>
            <p className="muted" style={{ margin: 0 }}>
              Active scaffold: <b>{activeScaffold.label}</b> ({checkPassCount}/{activeChecks.length} checks passed)
            </p>
            {activeChecks.map((check) => (
              <div key={check.key} className="stat" style={{ padding: "8px 10px" }}>
                <b>{check.passed ? "PASS" : "MISSING"}</b> - {check.label}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
