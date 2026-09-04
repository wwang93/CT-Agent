"use client";
import { useEffect, useState } from "react";
import type { Analytics } from "@/lib/education/types";
import CourseHeader from "./CourseHeader";
import AccessNotice from "./AccessNotice";
import { downloadJson, educationApi, useEducation } from "./useEducation";
export default function ResearchWorkspace() {
  const {data,loading,error:accessError,refresh} = useEducation();
  const [stats,setStats] = useState<Analytics | null>(null), [error,setError] = useState(""), [busy,setBusy] = useState(false), [confirmed,setConfirmed] = useState(false);
  async function fetchStats() { setError("");setBusy(true);try {setStats(await educationApi<Analytics>("?view=research"));} catch(err) {setError((err as Error).message);} finally {setBusy(false);} }
  useEffect(() => {if(data?.user.role === "researcher") void fetchStats();},[data]);
  async function exportData() {setBusy(true);setError("");try {const fresh=await educationApi<Analytics>("?view=research&export=1");downloadJson(`教育心理学-授权研究记录-${new Date().toISOString().slice(0,10)}.json`,fresh);setStats(fresh);} catch(err) {setError((err as Error).message);} finally {setBusy(false);} }
  return <div className="edu-app"><CourseHeader active="research" />{!data || data.user.role !== "researcher" ? <AccessNotice loading={loading} error={accessError} mismatch={data ? "研究权限与教学权限分开配置；教师身份不会自动获得研究数据导出权限。" : ""} onRetry={refresh} /> : <main className="edu-page"><div className="edu-page-heading"><div><div className="edu-eyebrow">研 / 授权记录</div><h1>从交互证据开始，不替学生下结论</h1><p>只有仍同意当前研究告知版本的学生记录会进入本页。</p></div><button className="edu-button secondary" disabled={busy} onClick={fetchStats}>刷新授权数据</button></div>
    <div className="edu-callout">{stats?.researchEnabled ? `当前方案：${stats.protocol}` : "研究功能尚未开启。当前不会向研究端提供教学记录。"}</div>
    <section className="edu-metrics">{[["授权学习者",stats?.learners],["学习记录",stats?.total],["完成四阶段",stats?.completed],["AI 对话轮次",stats?.chats]].map(([name,value]) => <div key={name}><span>{name}</span><strong>{value ?? "—"}</strong></div>)}</section>
    <section className="edu-panel"><h2>单元记录分布</h2>{stats?.units.map((unit) => <div className="edu-distribution" key={unit.unitId}><strong>单元 {unit.unitId}</strong><span>开始 {unit.started}</span><span>完成 {unit.completed}</span></div>)}{stats?.total === 0 && <p className="edu-empty">暂无符合当前授权条件的真实记录。</p>}<p className="edu-caption">完成次数、提示层数与对话轮次是描述性过程指标，不是学习增益或因果效应。不能用使用量替代理解程度。</p></section>
    <section className="edu-panel"><h2>导出可审查的交互证据</h2><p>导出包含初答、修订、迁移、反思、提示、AI 问答、任务版本和时间。每次导出都会重新检查授权；不包含账号邮箱或真实姓名字段。</p><p>自由文本仍可能含个人信息。邮箱和部分电话会被自动遮蔽，但假名化不等于匿名化。分享或发表前必须人工审查。撤回后的未来导出会排除历史记录，已经导出的副本需按研究方案处理。</p><label className="edu-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />我会按已审核方案保管导出文件，审查文本标识信息，并执行保存期限与退出要求。</label><button className="edu-button" disabled={busy || !confirmed || !stats?.total || !stats.researchEnabled} onClick={exportData}>重新核验授权并导出 JSON</button>{stats?.truncated && <p role="alert">记录超过读取上限，导出不完整；请先扩展分页能力。</p>}</section>
    <section className="edu-panel"><h2>建议的首轮人工编码</h2><p>观察学生是否区分相近概念、引用案例证据、修订解释、提出替代解释，并将概念用于新情境。采用明确量规和双人编码核验；本版不会让 AI 自动判断“认知水平”。</p></section>
  </main>}{error && <div className="edu-toast error" role="alert">{error}</div>}</div>;
}
