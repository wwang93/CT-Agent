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
    <section className="edu-panel"><h2>五次干预记录分布</h2>{stats?.interventions.map((item) => <div className="edu-distribution" key={item.id}><strong>干预 {item.id} · {item.title}</strong><span>{item.ready ? `开始 ${item.started}` : "待选讲义"}</span><span>完成 {item.completed}</span></div>)}{stats?.total === 0 && <p className="edu-empty">暂无符合当前授权条件的真实记录。</p>}<p className="edu-caption">五次干预分布仅统计有明确干预编号的记录；上方总量可能包含旧版学习。完成次数、提示层数与对话轮次是过程指标，不是学习增益或因果效应。</p><p className="edu-caption">已记录 AI 请求失败：{stats?.aiErrors ?? 0} 次；失败不计入成功对话。</p></section>
    <section className="edu-panel"><h2>导出可审查的交互证据</h2><p>导出包含初答、修订、迁移、反思、提示、AI 问答、任务版本和时间。每次导出都会重新检查授权；不包含账号邮箱或真实姓名字段。</p><p>自由文本仍可能含个人信息。邮箱和部分电话会被自动遮蔽，但假名化不等于匿名化。分享或发表前必须人工审查。撤回后的未来导出会排除历史记录，已经导出的副本需按研究方案处理。</p><label className="edu-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />我会按已审核方案保管导出文件，审查文本标识信息，并执行保存期限与退出要求。</label><button className="edu-button" disabled={busy || !confirmed || !stats?.total || !stats.researchEnabled} onClick={exportData}>重新核验授权并导出 JSON</button>{stats?.truncated && <p role="alert">记录超过读取上限，导出不完整；请先扩展分页能力。</p>}</section>
    <section className="edu-panel"><h2>建议的首轮人工编码</h2><p>干预一：检查四个概念与经历证据的连接、替代解释及检查方案。干预二：检查问题表征、主张与证据、方案生成与选择、迁移中的适配。两次都比较初答、修订和独立迁移，核对修订理由，不只比较文字长度。</p><p>采用明确量规和双人编码核验；本版不会让 AI 自动判断“认知水平”。模型别名可能由供应商升级，导出同时保留请求模型、返回模型与时间，不保证供应商权重可完全复现。</p></section>
  </main>}{error && <div className="edu-toast error" role="alert">{error}</div>}</div>;
}
