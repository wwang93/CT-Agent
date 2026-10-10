"use client";
import { useEffect, useRef, useState } from "react";
import type { IssuedLearningCode, LearningAccount } from "@/lib/education/learning-identity";
import { educationApi } from "./useEducation";
type Roster = { accounts: Pick<LearningAccount, "learnerId" | "status" | "createdAt" | "resetAt">[]; truncated: boolean };
export default function LearningIdManager() {
  const [roster, setRoster] = useState<Roster | null>(null), [ids, setIds] = useState("");
  const [singleId, setSingleId] = useState(""), [manualCode, setManualCode] = useState("");
  const [issued, setIssued] = useState<IssuedLearningCode[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const stop = useRef(false);
  async function refresh() { setRoster(await educationApi<Roster>("?view=learningIds")); }
  useEffect(() => { stop.current = false; void refresh().catch((err) => setError(err.message)); return () => { stop.current = true; }; }, []);
  useEffect(() => { if (!issued.length) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [issued.length]);
  function remember(code: IssuedLearningCode) { setIssued((old) => [...old.filter((item) => item.learnerId !== code.learnerId), code]); }
  async function createBatch(list: string[], accessCode?: string) {
    setBusy(true); setError(""); setMessage(""); stop.current = false;
    const normalized = [...new Set(list.map((id) => id.trim().toUpperCase()).filter(Boolean))];
    let created = 0, skipped = 0; const failed: string[] = [];
    try {
      if (!normalized.length || normalized.length > 100) throw new Error("每批请输入 1—100 个不同的学习 ID。");
      if (normalized.some((id) => !/^[A-Z][A-Z0-9-]{2,23}$/.test(id))) throw new Error("ID 须为 3—24 位字母、数字或短横线，以字母开头。请勿使用姓名、邮箱或手机号。");
      if (accessCode && (!/^[A-Za-z0-9][A-Za-z0-9_-]{11,127}$/.test(accessCode) || !/[A-Za-z]/.test(accessCode) || /^(.)\1+$/.test(accessCode))) throw new Error("访问码须为 12—128 位，以字母或数字开头，至少包含一个字母，且不能全部使用同一个字符。");
      for (const [index, learnerId] of normalized.entries()) {
        if (stop.current) break;
        setMessage(`正在处理 ${index + 1}/${normalized.length}：${learnerId}。`);
        try {
          const result = await educationApi<IssuedLearningCode & { skipped: boolean }>("", { action: "issueLearningId", learnerId, ...(accessCode ? { accessCode } : {}) });
          if (result.skipped) skipped++; else { created++; remember(result); }
        } catch { failed.push(learnerId); }
      }
      setMessage(`本批完成：创建 ${created} 个，已有 ${skipped} 个未改动${stop.current ? "（已停止）" : ""}。请下载并私密发放本次访问码。`);
      if (failed.length) setError(`以下 ID 未完成：${failed.join("、")}。可重新创建以恢复；若状态为重置中，请重新执行重置。`);
      setManualCode(""); await refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function reset(learnerId: string) {
    if (!window.confirm(`重置 ${learnerId} 的访问码？旧码失效，学习 ID 和历史记录保留。请单独发放新码。`)) return;
    setBusy(true); setError(""); setMessage("");
    try { const code = await educationApi<IssuedLearningCode>("", { action: "resetLearningCode", learnerId }); remember(code); setMessage(`${learnerId} 已重置。请下载新访问码，历史记录没有改变。`); await refresh(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  function download() {
    const csv = "\uFEFF学习ID,个人访问码\r\n" + issued.map((item) => `${item.learnerId},${item.accessCode}`).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `学习访问码-私密-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="edu-panel"><div className="edu-panel-title"><h2>学生名单</h2><button className="edu-button secondary" disabled={busy} onClick={() => { void refresh().catch((err) => setError(err.message)); }}>刷新名单</button></div>
    <p>每个学生固定一个 ID 和一个私密访问码，贯穿五次学习活动。创建时已加入课程，不必另填班级邀请码；课堂开关与任务发布仍然生效。</p>
    <p className="edu-caption">访问码只在本次创建或重置后留在页面内存，不写入教学数据库。离开前请下载名单。名单文件 含登录凭证，不能发全班群或上传研究资料；逐人发放，实名对应表另存。</p>
    <details className="edu-editor-details"><summary>添加更多学生账号</summary><label htmlFor="learning-id-list">批量学习 ID（每行一个，最多 100 个）</label><textarea id="learning-id-list" rows={5} placeholder={"L-001\nL-002\nL-003"} value={ids} disabled={busy} onChange={(e) => setIds(e.target.value)} />
    <div className="edu-actions"><button className="edu-button secondary" disabled={busy} onClick={() => setIds(Array.from({ length: 100 }, (_, i) => `L-${String(i + 1).padStart(3, "0")}`).join("\n"))}>填入 L-001 至 L-100（尚不创建）</button><button className="edu-button" disabled={busy || !ids.trim()} onClick={() => { void createBatch(ids.split(/\r?\n/)); }}>创建并生成固定访问码</button>{busy && <button className="edu-button secondary" onClick={() => { stop.current = true; }}>处理完当前 ID 后停止</button>}</div>
    <details className="edu-editor-details"><summary>单个创建 / 手动指定固定访问码</summary><div className="edu-form-grid"><label>学习 ID<input maxLength={24} value={singleId} disabled={busy} onChange={(e) => setSingleId(e.target.value)} placeholder="例如 L-101" /></label><label>固定访问码（留空则随机生成）<input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={manualCode} disabled={busy} onChange={(e) => setManualCode(e.target.value)} /></label></div><p className="edu-caption">手动访问码至少 12 位，使用字母、数字、短横线或下划线；不要使用 ID、学号或全班共用密码。创建已有 ID 不会更改其访问码。</p><button className="edu-button secondary" disabled={busy || !singleId.trim() || (Boolean(manualCode) && (manualCode.length < 12 || !/^[A-Za-z0-9_-]+$/.test(manualCode)))} onClick={() => { void createBatch([singleId], manualCode); }}>创建单个学习 ID</button></details>
    </details>
    {issued.length > 0 && <div className="edu-callout"><p>本页有 {issued.length} 组新访问码。旧码无法再次查询；遗失时请重置。</p><div className="edu-actions"><button className="edu-button" onClick={download}>下载本次发放名单</button><button className="edu-button secondary" disabled={busy} onClick={() => { if (window.confirm("确认已下载并保存？清除后不能再次查询这些访问码。")) setIssued([]); }}>清除页面中的访问码</button></div></div>}
    {message && <p role="status">{message}</p>}{error && <p className="edu-inline-error" role="alert">{error}</p>}
    {roster?.truncated && <p role="alert">名单超过读取上限，当前显示不完整。</p>}
    {roster && <div className="edu-roster"><div className="edu-panel-title"><h3>已登记 {roster.accounts.length} 位学生</h3><span className="edu-caption">访问码遗失时可单独重置</span></div><label htmlFor="roster-search">查找学生 ID</label><input id="roster-search" type="search" placeholder="例如 L-025" value={search} onChange={event => setSearch(event.target.value)} /><div className="edu-table-wrap"><table><thead><tr><th>学习 ID</th><th>状态</th><th>操作</th></tr></thead><tbody>{[...roster.accounts].filter(account => account.learnerId.includes(search.trim().toUpperCase())).sort((a, b) => a.learnerId.localeCompare(b.learnerId)).map((account) => <tr key={account.learnerId}><td>{account.learnerId}</td><td>{account.status === "active" ? "可登录" : account.status === "resetting" ? "重置待完成" : "创建待完成"}</td><td>{account.status === "provisioning" ? <button className="edu-text-link" disabled={busy} onClick={() => { void createBatch([account.learnerId]); }}>继续创建</button> : <button className="edu-text-link" disabled={busy} onClick={() => { void reset(account.learnerId); }}>重置个人访问码</button>}</td></tr>)}</tbody></table></div></div>}
  </section>;
}
