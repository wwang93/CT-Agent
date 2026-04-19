"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChatMessage, TemplateScaffold } from "@/lib/types";

const DEMO_USER = "student-demo-001";

export default function StudentCoach() {
  const [objective, setObjective] = useState("Evaluate methodological rigor in qualitative studies.");
  const [context, setContext] = useState("Use examples relevant to first-generation college students in Appalachia.");
  const [courseId, setCourseId] = useState("RME-600");
  const [weekNumber, setWeekNumber] = useState("4");
  const [assignmentId, setAssignmentId] = useState("weekly-reflection-memo");
  const [sessionId] = useState(() =>
    `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [injectedTemplate, setInjectedTemplate] = useState("");
  const [injectedScaffold, setInjectedScaffold] = useState<TemplateScaffold | null>(null);
  const [injectedTemplateVersion, setInjectedTemplateVersion] = useState<number | null>(null);
  const [templateUpdatedAt, setTemplateUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncingTemplate, setSyncingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = input.trim().length > 0 && !loading;

  const turnCount = useMemo(() => messages.filter((m) => m.role === "user").length, [messages]);

  const syncTemplate = async () => {
    const trimmedCourse = courseId.trim();
    const trimmedAssignment = assignmentId.trim();
    const parsedWeek = Number(weekNumber);
    if (!trimmedCourse || !trimmedAssignment || !Number.isFinite(parsedWeek)) return;

    setSyncingTemplate(true);
    try {
      const query = new URLSearchParams({
        courseId: trimmedCourse,
        weekNumber: String(parsedWeek),
        assignmentId: trimmedAssignment,
      });
      const res = await fetch(`/api/templates?${query.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load course template.");

      const active = (data.activeTemplate as string | undefined) ?? "";
      const scaffold = (data.activeScaffold as TemplateScaffold | null | undefined) ?? null;
      const record = data.record as { updatedAt?: string; templateVersion?: number } | null | undefined;

      setInjectedTemplate(active);
      setInjectedScaffold(scaffold);
      setInjectedTemplateVersion(
        typeof record?.templateVersion === "number" ? record.templateVersion : null,
      );
      setTemplateUpdatedAt(record?.updatedAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync template.");
    } finally {
      setSyncingTemplate(false);
    }
  };

  useEffect(() => {
    void syncTemplate();
  }, [courseId, weekNumber, assignmentId]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    const parsedWeek = Number(weekNumber);
    const trimmedAssignment = assignmentId.trim();
    if (!Number.isFinite(parsedWeek) || !trimmedAssignment) {
      setError("Week number and assignment ID are required.");
      return;
    }

    const nextUser: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const nextConversation = [...messages, nextUser];
    setMessages(nextConversation);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "student",
          userId: DEMO_USER,
          courseId,
          weekNumber: parsedWeek,
          assignmentId: trimmedAssignment,
          sessionId,
          turnIndex: turnCount + 1,
          learnerMessage: text,
          learningObjective: objective,
          culturalContext: context,
          injectedTemplate,
          injectedTemplateId: injectedScaffold?.id ?? "",
          injectedTemplateVersion: injectedTemplateVersion ?? undefined,
          conversation: nextConversation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to get coach response.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <section className="card" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Session setup</h3>
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
            <label>Learning objective</label>
            <input className="input" value={objective} onChange={(e) => setObjective(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Cultural context</label>
            <input className="input" value={context} onChange={(e) => setContext(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={syncTemplate} disabled={syncingTemplate}>
            {syncingTemplate ? "Syncing..." : "Sync instructor template"}
          </button>
          <span className="pill">{injectedTemplate ? "Template injected" : "No template injected"}</span>
          {templateUpdatedAt ? <span className="muted">Updated: {new Date(templateUpdatedAt).toLocaleString()}</span> : null}
          {injectedTemplateVersion ? <span className="muted">Version: v{injectedTemplateVersion}</span> : null}
        </div>
        {injectedTemplate ? (
          <div className="message message-assistant" style={{ marginTop: 12 }}>
            <b>Active instructor template:</b> {injectedTemplate}
            {injectedScaffold ? (
              <div style={{ marginTop: 10 }}>
                <div className="pill" style={{ marginBottom: 8 }}>
                  {injectedScaffold.intensity.toUpperCase()} guidance
                </div>
                <div className="muted">
                  HOT focus: {injectedScaffold.hotDimensions.join(", ")}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0 }}>Socratic dialogue</h3>
          <span className="pill">Turns: {turnCount}</span>
        </div>

        <div className="grid" style={{ gap: 10, marginBottom: 14 }}>
          {messages.length === 0 && <p className="muted">Start by sharing your draft claim or interpretation.</p>}
          {messages.map((message, idx) => (
            <div
              key={`${message.timestamp}-${idx}`}
              className={`message ${message.role === "user" ? "message-user" : "message-assistant"}`}
            >
              <b>{message.role === "user" ? "You" : "CT-AGENT"}:</b> {message.content}
            </div>
          ))}
        </div>

        <div className="grid" style={{ gap: 10 }}>
          <textarea
            className="textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write your current argument, evidence, or uncertainty..."
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={send} disabled={!canSend}>
              {loading ? "Thinking..." : "Send"}
            </button>
            <button className="btn btn-secondary" onClick={syncTemplate} disabled={syncingTemplate || loading}>
              Refresh template
            </button>
            <button className="btn btn-secondary" onClick={() => setMessages([])} disabled={loading}>
              Reset Session
            </button>
          </div>
          {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}
        </div>
      </section>
    </div>
  );
}
