"use client";

import { useEffect, useState } from "react";

import type { AnalyticsSummary } from "@/lib/types";

const emptySummary: AnalyticsSummary = {
  totalChatTurns: 0,
  uniqueLearners: 0,
  avgPromptLength: 0,
  evidenceUseRate: 0,
  counterargumentRate: 0,
  highOrderSignalRate: 0,
  engagementProfiles: [
    { bucket: "high", users: 0 },
    { bucket: "moderate", users: 0 },
    { bucket: "low", users: 0 },
  ],
  weeklyTurnCounts: [],
};

export default function ResearchAnalytics() {
  const [courseId, setCourseId] = useState("RME-600");
  const [weekNumber, setWeekNumber] = useState("4");
  const [assignmentId, setAssignmentId] = useState("weekly-reflection-memo");
  const [summary, setSummary] = useState<AnalyticsSummary>(emptySummary);
  const [sampleSize, setSampleSize] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        courseId,
        weekNumber,
        assignmentId,
      });
      const res = await fetch(`/api/analytics?${query.toString()}`);
      const data = await res.json();
      setSummary(data.summary ?? emptySummary);
      setSampleSize(data.sampleSize ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <section className="card" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Analytics controls</h3>
        <div className="grid" style={{ gridTemplateColumns: "1fr 140px 1fr auto", gap: 10 }}>
          <input className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)} />
          <input className="input" value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} />
          <input className="input" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} />
          <button className="btn" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
        </div>
        <p className="muted" style={{ marginBottom: 2 }}>
          Filters: course, week, assignment
        </p>
        <p className="muted">Current sample size: {sampleSize} logged events</p>
      </section>

      <section className="grid grid-3">
        <div className="stat"><b>Total chat turns</b><div>{summary.totalChatTurns}</div></div>
        <div className="stat"><b>Unique learners</b><div>{summary.uniqueLearners}</div></div>
        <div className="stat"><b>Average prompt length</b><div>{summary.avgPromptLength}</div></div>
        <div className="stat"><b>Evidence use rate</b><div>{summary.evidenceUseRate}%</div></div>
        <div className="stat"><b>Counterargument rate</b><div>{summary.counterargumentRate}%</div></div>
        <div className="stat"><b>High-order signal rate</b><div>{summary.highOrderSignalRate}%</div></div>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Engagement profiles</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>Profile</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>Users</th>
            </tr>
          </thead>
          <tbody>
            {summary.engagementProfiles.map((row) => (
              <tr key={row.bucket}>
                <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9", textTransform: "capitalize" }}>{row.bucket}</td>
                <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>{row.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Weekly turn breakdown</h3>
        {summary.weeklyTurnCounts.length === 0 ? (
          <p className="muted">No weekly chat-turn data for this filter.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>Week</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>Chat Turns</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>Unique Learners</th>
              </tr>
            </thead>
            <tbody>
              {summary.weeklyTurnCounts.map((row) => (
                <tr key={`week-${row.weekNumber}`}>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>Week {row.weekNumber}</td>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>{row.chatTurns}</td>
                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>{row.uniqueLearners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
