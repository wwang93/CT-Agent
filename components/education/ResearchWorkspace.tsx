"use client";
import { useEffect, useRef, useState } from "react";
import { STAGES } from "@/lib/education/course";
import type { Analytics, LearningSession, ResearchConsentStatus } from "@/lib/education/types";
import CourseHeader from "./CourseHeader";
import AccessNotice from "./AccessNotice";
import { downloadJson, educationApi, useEducation } from "./useEducation";

const consentLabels: Record<ResearchConsentStatus, string> = { authorized: "已授权", "not-consented": "未授权", outdated: "需重新确认", disabled: "研究未开启" };
const stageLabel = (stage: string) => stage === "complete" ? "已完成" : STAGES.find((item) => item.id === stage)?.short ?? stage;
const timeLabel = (time: string) => new Date(time).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
export default function ResearchWorkspace() {
  const { data, loading, error: accessError, refresh } = useEducation();
  const [view, setView] = useState<"administration" | "research">("administration");
  const [stats, setStats] = useState<Analytics | null>(null), [session, setSession] = useState<LearningSession | null>(null), [selectedCode, setSelectedCode] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false), [query, setQuery] = useState("");
  const requestSequence = useRef(0);
  const canAdmin = Boolean(data?.user.canReadAllCourseRecords);
  const activeView = canAdmin ? view : "research";
  const administration = activeView === "administration";
  async function fetchStats() {
    const sequence = ++requestSequence.current;
    setError(""); setBusy(true); setSession(null); setStats(null);
    try { const fresh = await educationApi<Analytics>(`?view=${activeView}`); if (sequence === requestSequence.current) setStats(fresh); }
    catch (err) { if (sequence === requestSequence.current) setError((err as Error).message); }
    finally { if (sequence === requestSequence.current) setBusy(false); }
  }
  useEffect(() => {
    if (data?.user.role === "researcher") void fetchStats();
    return () => { requestSequence.current++; };
    // Refresh only when the verified identity or selected scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.user.id, data?.user.role, activeView]);
  async function openRecord(id: string, code: string) {
    setBusy(true); setError(""); setSession(null);
    try { const result = await educationApi<{ session: LearningSession }>(`?session=${encodeURIComponent(id)}`); setSession(result.session); setSelectedCode(code); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function exportData() {
    if (administration) return;
    setBusy(true); setError("");
    try { const fresh = await educationApi<Analytics>("?view=research&export=1"); downloadJson(`教育心理学-授权研究记录-${new Date().toISOString().slice(0, 10)}.json`, fresh); setStats(fresh); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const rows = stats?.rows.filter((row) => !query.trim() || row.learnerCode?.toUpperCase().includes(query.trim().toUpperCase())) ?? [];
  return <div className="edu-app"><CourseHeader active="research" />{!data || data.user.role !== "researcher" ? <AccessNotice loading={loading} error={accessError} mismatch={data ? "研究管理账号由管理员配置，教师或学生身份不能自行提升权限。" : ""} onRetry={refresh} /> : <main className="edu-page">
    <div className="edu-page-heading"><div><div className="edu-eyebrow">教育心理学 · {data.user.learnerCode}</div><h1>{administration ? "全班记录管理" : "经授权的研究资料"}</h1><p>{administration ? "回看全班已保存的学习轨迹，核对回答、提示、答疑与教师反馈。" : "只有仍同意当前研究告知版本的学生记录会进入本页。"}</p></div><button className="edu-button secondary" disabled={busy} onClick={() => { void fetchStats(); }}>刷新记录</button></div>
    {canAdmin && <div className="edu-workspace-nav" role="group" aria-label="记录查看范围">{([["administration", "全班记录"], ["research", "授权研究资料"]] as const).map(([id, label]) => <button key={id} disabled={busy} className={view === id ? "active" : ""} aria-pressed={view === id} onClick={() => { setView(id); setConfirmed(false); setQuery(""); }}>{label}</button>)}</div>}
    <div className="edu-callout">{administration ? "本页包含未同意、已退出研究的学生记录，供课程核查与教学管理；查看操作会留痕。全量查看不等于研究同意，未授权记录不能自动作为研究样本。此身份只读，不能改写回答、发放访问码或发布任务。" : stats?.researchEnabled ? `当前方案：${stats.protocol}` : "自愿研究参与尚未开启，本页暂无授权研究记录。全班管理查看是另一项独立权限。"}</div>
    <section className="edu-metrics">{[[administration ? "课程学生" : "授权学习者", administration ? stats?.members : stats?.learners], ["学习记录", stats?.total], ["完成四阶段", stats?.completed], ["答疑轮次", stats?.chats]].map(([name, value]) => <div key={name}><span>{name}</span><strong>{value ?? "—"}</strong></div>)}</section>
    {administration ? <>
      <section className="edu-panel"><div className="edu-panel-title"><h2>全班学习轨迹</h2><span className="edu-caption">有记录的学生：{stats?.learners ?? "—"} · 时间均为北京时间</span></div><label htmlFor="research-student-filter">按学生 ID 查找<input id="research-student-filter" value={query} maxLength={24} placeholder="例如 L-001" onChange={(e) => setQuery(e.target.value)} /></label>
        <div className="edu-table-wrap"><table><thead><tr><th>学生 ID</th><th>活动 / 教学周</th><th>进度</th><th>研究选择</th><th>提示 / 答疑</th><th>最近更新</th><th>记录</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.learnerCode}</td><td>{row.interventionId ? `活动 ${row.interventionId}` : `单元 ${row.unitId}`} · 第 {row.scheduledWeek} 周<br /><small>任务 v{row.taskVersion}</small></td><td>{stageLabel(row.stage)}</td><td>{consentLabels[row.researchConsent ?? "not-consented"]}</td><td>{row.hints} / {row.chats}</td><td>{timeLabel(row.updatedAt)}</td><td><button className="edu-button secondary" disabled={busy} onClick={() => { void openRecord(row.id, row.learnerCode ?? ""); }}>查看轨迹</button></td></tr>)}</tbody></table></div>
        {!busy && !rows.length && <p className="edu-empty">{query.trim() ? "该 ID 暂无已保存的学习记录。" : "暂无真实学习记录。学生完成正式任务后，记录会显示在这里；任务预览不保存。"}</p>}
        {stats?.truncated && <p role="alert">记录超过当前读取上限，本页并非完整结果。请联系管理员扩展分页后再核查。</p>}
      </section>
      {session && <section className="edu-panel"><div className="edu-panel-title"><h2>{selectedCode} · 学习轨迹</h2><button className="edu-button secondary" onClick={() => setSession(null)}>收起</button></div><p>{session.task.task.title} · 第 {session.task.scheduledWeek} 周 · 任务 v{session.task.version} · {stageLabel(session.stage)}</p><p className="edu-caption">只读记录，显示学生当时使用的任务版本。预览与失败答疑不算作学习成效。</p>{session.entries.map((entry) => <article className="edu-review-record" key={entry.id}><h3>{entry.kind === "answer" ? stageLabel(entry.stage) : entry.kind === "hint" ? `教师提示 · 第 ${entry.level} 层` : entry.kind === "chat" ? "学习答疑" : entry.kind === "feedback" ? "教师反馈" : "未完成的答疑"}</h3><small>{timeLabel(entry.createdAt)}</small><p className="edu-prewrap">{entry.text}</p>{entry.reply && <div className="edu-ai-reply edu-prewrap">{entry.reply}</div>}</article>)}{!session.entries.length && <p className="edu-empty">这次任务尚未提交回答。</p>}</section>}
    </> : <section className="edu-panel"><h2>导出可审查的交互证据</h2><p>导出包含初答、修订、迁移、反思、提示、答疑记录、任务版本和时间。每次导出都会重新检查授权；不包含账号邮箱或真实姓名字段。</p><p>自由文本仍可能含个人信息。邮箱和部分电话会被自动遮蔽，但假名化不等于匿名化。分享或发表前必须人工审查。撤回后的未来导出会排除历史记录，已经导出的副本需按研究方案处理。</p><label className="edu-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />我会按已审核方案保管导出文件，审查文本标识信息，并执行保存期限与退出要求。</label><button className="edu-button" disabled={busy || !confirmed || !stats?.total || !stats.researchEnabled || stats.truncated} onClick={() => { void exportData(); }}>核验授权并下载记录</button>{stats?.truncated && <p role="alert">记录超过读取上限，暂不可导出；请联系管理员扩展分页。</p>}</section>}
    <section className="edu-panel"><h2>五次活动记录分布</h2>{stats?.interventions.map((item) => <div className="edu-distribution" key={item.id}><strong>活动 {item.id} · {item.title}</strong><span>{item.ready ? `开始 ${item.started}` : "待选讲义"}</span><span>完成 {item.completed}</span></div>)}<p className="edu-caption">完成次数、提示层数与对话轮次是过程指标，不是学习增益或因果效应。未完成的答疑：{stats?.aiErrors ?? 0} 次，不计入成功对话。</p></section>
  </main>}{busy && <div className="edu-toast" role="status">正在读取记录…</div>}{error && <div className="edu-toast error" role="alert">{error}</div>}</div>;
}
