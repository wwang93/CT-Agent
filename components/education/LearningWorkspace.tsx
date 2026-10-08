"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ACTIVE_UNIT_IDS, COURSE, INTERVENTIONS, STAGES, TASKS, getInterventionForUnit } from "@/lib/education/course";
import { applyAnswer, applyHint } from "@/lib/education/engine";
import type { LearningSession } from "@/lib/education/types";
import CourseHeader from "./CourseHeader";
import AccessNotice from "./AccessNotice";
import { downloadJson, educationApi, useEducation } from "./useEducation";

function previewSession(unitId: number): LearningSession {
  const intervention = getInterventionForUnit(unitId)!;
  return { id: "preview", ownerId: "preview", unitId, interventionId: intervention.id, courseVersion: COURSE.version,
    task: { task: TASKS[unitId], version: 1, published: false, scheduledWeek: intervention.week!, interventionId: intervention.id, teacherNotes: "", reviewedAt: "", reviewedBy: "" }, stage: "initial", entries: [], language: "英语", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
export default function LearningWorkspace({ preview = false }: { preview?: boolean }) {
  const params = useSearchParams(), requestedUnit = Number(params.get("unit") || 6), unit = ACTIVE_UNIT_IDS.includes(requestedUnit) ? requestedUnit : 6;
  const { data, loading, error: accessError, refresh } = useEducation(!preview);
  const [session, setSession] = useState<LearningSession | null>(null), [text, setText] = useState(""), [question, setQuestion] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [code, setCode] = useState(""), [language, setLanguage] = useState("英语"), [consent, setConsent] = useState(false), [message, setMessage] = useState("");
  const pending = useRef<{ signature: string; id: string } | null>(null);
  useEffect(() => { if (preview) {setSession(previewSession(unit));setText("");setQuestion("");} }, [preview, unit]);
  useEffect(() => { setConsent(Boolean(data?.consent.enabled && data.consent.noticeVersion === data.settings.noticeVersion)); }, [data]);
  async function action(body: Record<string, unknown>) {
    setBusy(true); setError(""); setMessage("");
    const signature = JSON.stringify(body);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    const id = pending.current.id;
    try {
      if (preview && session) {
        if (body.action === "answer") setSession(applyAnswer(session, { id, stage: body.stage, text: body.text }, new Date().toISOString()));
        if (body.action === "hint") setSession(applyHint(session, id, new Date().toISOString()));
      } else {
        const result = await educationApi<{ session?: LearningSession }>("", { ...body, requestId: id });
        if (result.session) setSession(result.session);
        else { await refresh(); setMessage(body.action === "consent" ? "研究使用选择已更新。退出后，之后的研究读取与导出将排除你的历史记录；已合法导出的副本需联系研究负责人处理。" : "已加入课程。"); }
      }
      pending.current = null;
      if (body.action === "answer") setText("");
      if (body.action === "chat") setQuestion("");
    } catch (err) { setError(err instanceof Error ? err.message : "操作失败。"); }
    finally { setBusy(false); }
  }
  async function resume(id: string) { setBusy(true); setError(""); try { const result = await educationApi<{session: LearningSession}>(`?session=${encodeURIComponent(id)}`); setSession(result.session); setText(""); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  const task = session?.task.task, currentStage = session?.stage === "complete" ? null : session?.stage;
  const answers = session?.entries.filter((entry) => entry.kind === "answer") ?? [];
  const hints = session?.entries.filter((entry) => entry.kind === "hint") ?? [];
  const isolated = session?.stage === "initial" || session?.stage === "transfer";
  const mismatch = data && data.user.role !== "student";
  const sessionAIReady = session?.ai ? Boolean(data?.aiAvailability[session.ai.provider]) : Boolean(data?.aiEnabled);
  const modelLabel = session?.ai ? `${session.ai.provider === "deepseek" ? "DeepSeek 官方" : "OpenAI"} / ${session.ai.model}` : data?.ai.provider === "deepseek" ? `DeepSeek 官方 / ${data.ai.model}` : `OpenAI / ${data?.ai.model || "未配置"}`;
  return <div className="edu-app"><CourseHeader active="student" />{preview && <div className="edu-preview-banner"><strong>样板预览</strong> · 教师编写的固定脚手架，不调用 AI、不保存输入、不产生研究数据。<Link href="/student">进入正式学习 →</Link></div>}
    {!preview && (!data || mismatch) ? <AccessNotice loading={loading} error={accessError} mismatch={mismatch ? "此页面供学生使用；教师可从工作台预览同样的学习流程。" : ""} onRetry={refresh} /> : !session ? <main className="edu-page"><div className="edu-page-heading"><div><div className="edu-eyebrow">我的学习 / {COURSE.id}</div><h1>把自己的理解留下来</h1><p>先选择一个已发布的任务，或继续之前的学习。</p></div><Link className="edu-button secondary" href="/">回到五次干预</Link></div>
      {!data?.member && <section className="edu-panel"><h2>加入教育心理学课程</h2><p>使用教师发放的邀请码加入。注册账号不代表已经加入课程。</p><label htmlFor="join-code">课程邀请码</label><div className="edu-inline-form"><input id="join-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} autoComplete="off" /><button className="edu-button" disabled={busy || !code.trim()} onClick={() => action({action:"join",code})}>加入课程</button></div></section>}
      {!data?.classroomEnabled && <div className="edu-callout">正式课堂尚未开放。你可以预览前两次任务，教师完成运行配置并审核发布后再开始保存学习记录。</div>}
      <section className="edu-two-col">{INTERVENTIONS.map((item) => {
        const id = item.unitId;
        const config = id ? data?.configs.find((value) => value.task.unitId === id && value.published && value.interventionId === item.id) : undefined;
        return <article className={`edu-panel ${item.ready ? "" : "edu-pending-card"}`} key={item.id}>
          <div className="edu-eyebrow">干预 {item.id} {id ? `· 单元 ${id} · Week ${config?.scheduledWeek ?? item.week}` : "· 待选讲义"}</div>
          <h2>{item.title}</h2><p>{config?.task.objective || (id ? TASKS[id].objective : item.focus)}</p>
          {id ? <><p className="edu-caption">{config ? `教师已发布 · 任务 v${config.version}` : "待教师审核发布新的干预版本"}</p><label htmlFor={`language-${id}`}>我的主要学习语言</label><select id={`language-${id}`} value={language} onChange={(e) => setLanguage(e.target.value)}>{["英语","日语","俄语","法语","德语","其他语言"].map((name) => <option key={name}>{name}</option>)}</select><div className="edu-actions"><button className="edu-button" disabled={!config || !data?.member || !data.classroomEnabled || busy} onClick={() => action({action:"start",unitId:id,language})}>开始 / 继续学习 →</button><Link className="edu-text-link" href={`/preview?unit=${id}`}>任务预览</Link></div></> : <p className="edu-caption">尚未开放，不生成占位学习记录。</p>}
        </article>;
      })}</section>
      <section className="edu-panel"><h2>已保存的学习记录</h2>{!data?.sessions.length ? <p className="edu-muted">还没有记录。提交每个学习阶段后，内容会保存到课程账号。</p> : <div className="edu-record-list">{data.sessions.map((item) => <button key={item.id} onClick={() => resume(item.id)} disabled={busy}><span>{item.interventionId ? `干预 ${item.interventionId}` : "旧版学习"} · 单元 {item.unitId} · {item.stage === "complete" ? "理解记录已完成" : STAGES.find((stage) => stage.id === item.stage)?.short}</span><small>Week {item.scheduledWeek} · v{item.taskVersion} · {new Date(item.updatedAt).toLocaleString("zh-CN")}</small><span>查看 →</span></button>)}</div>}</section>
      <section className="edu-panel"><h2>学习记录与研究使用</h2><p>正式学习会保存你的回答、提示使用、AI 对话与教师反馈，用于课程支持。请不要填写真实第三方姓名、联系方式或敏感个人经历。个性化答疑会把相关任务材料、最近对话及你的问题发送至模型服务；当前新会话配置为 {data?.ai.provider === "deepseek" ? "DeepSeek 官方 API" : data?.ai.provider === "openai" ? "OpenAI" : "尚未正确配置"}。自动遮蔽邮箱和部分手机号不能保证匿名，请自行去除个人信息。</p>{data?.settings.researchEnabled ? <><p className="edu-prewrap">{data.settings.consentNotice}</p><p className="edu-caption">方案：{data.settings.researchProtocol} · 告知版本 {data.settings.noticeVersion}</p><label className="edu-check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />我自愿允许按以上告知，将课程记录用于研究。不同意或退出不影响课程学习。</label><button className="edu-button secondary" disabled={busy} onClick={() => action({action:"consent",enabled:consent,noticeVersion:data.settings.noticeVersion})}>保存我的选择</button></> : <p className="edu-caption">研究授权尚未启用。目前仅保存教学记录，研究端不会获得这些记录。</p>}</section>
    </main> : <main className="edu-workspace"><div className="edu-workspace-heading"><div><div className="edu-eyebrow">{session.interventionId ? `干预 ${session.interventionId}` : "旧版学习"} / Week {session.task.scheduledWeek} / 单元 {session.unitId} / {session.language}学习 / 任务 v{session.task.version}</div><h1>{task?.title}</h1></div><button className="edu-button secondary" disabled={busy} onClick={() => { if (preview) { setSession(previewSession(unit)); setText(""); setQuestion(""); } else { setSession(null); void refresh(); } }}>{preview ? "重新预览" : "返回学习记录"}</button></div>
      <ol className="edu-steps">{STAGES.map((stage,index) => <li key={stage.id} className={currentStage === stage.id ? "current" : answers.some((entry) => entry.stage === stage.id) ? "done" : ""}><b>{answers.some((entry) => entry.stage === stage.id) ? "✓" : String(index+1).padStart(2,"0")}</b><span>{stage.short}</span></li>)}</ol>
      <div className={`edu-task-grid ${isolated ? "independent" : ""}`}><section className="edu-task-main"><div className="edu-panel"><div className="edu-section-label">{currentStage === "transfer" ? "新情境 · 独立尝试" : "学习案例"}</div><p className="edu-case">{currentStage === "transfer" ? task?.prompts.transfer : task?.caseText}</p>{currentStage && <><h2>{STAGES.find((stage) => stage.id === currentStage)?.title}</h2>{currentStage !== "transfer" && <p>{task?.prompts[currentStage]}</p>}<label htmlFor="learner-answer">你的{currentStage === "reflection" ? "理解记录" : "解释"}</label><textarea id="learner-answer" value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} placeholder="请用自己的语言写下解释；保留不确定的地方也可以。" rows={7} disabled={busy} /><div className="edu-submit-row"><span className="edu-caption">{text.length}/5000 · {preview ? "预览内容不会保存" : "提交后保存；未提交文字仅保留在本页"}</span><button className="edu-button" disabled={busy || !text.trim()} onClick={() => action({action:"answer",sessionId:session.id,stage:currentStage,text})}>{busy ? "正在处理…" : currentStage === "reflection" ? "确认并保存理解记录" : "提交，进入下一步 →"}</button></div>{isolated && <p className="edu-caption">本阶段先独立完成。概念卡与提示暂时收起；这是学习检查，不是受监考考试。</p>}</>}
      {session.stage === "complete" && <div className="edu-complete"><div className="edu-eyebrow">四个阶段已完成</div><h2>你留下了一次可回看的理解变化</h2><p>完成记录不等于已经掌握。可以回看不同版本，带着仍未解决的问题参与课堂。</p><button className="edu-button secondary" onClick={() => downloadJson(`我的理解-单元${session.unitId}.json`,{course:COURSE.id,courseVersion:session.courseVersion,interventionId:session.interventionId,scheduledWeek:session.task.scheduledWeek,unitId:session.unitId,taskVersion:session.task.version,ai:session.ai,preview,entries:session.entries})}>导出我的学习记录</button></div>}</div>
      {session.stage === "revision" && <section className="edu-panel"><div className="edu-panel-title"><h2>需要一点支持？</h2><span className="edu-caption">已展开 {hints.length}/3 层</span></div>{hints.map((entry) => <div className="edu-hint" key={entry.id}><strong>提示 {entry.level} · {entry.level === 1 ? "方向提醒" : entry.level === 2 ? "概念支持" : "部分示范"}</strong><p>{entry.text}</p></div>)}<button className="edu-button secondary" disabled={busy || hints.length >= 3} onClick={() => action({action:"hint",sessionId:session.id})}>{hints.length ? "再多一点提示" : "给我一个方向提示"}</button><div className="edu-chat"><h3>围绕这次解释提问</h3><p className="edu-caption">{preview ? "样板预览不调用 AI。以下区域将在正式学习且模型服务已配置时开放。" : sessionAIReady ? `${modelLabel} · AI 只解释和追问，不代写。回复可能有误，请对照讲义核查；本次会话不自动切换模型。` : "模型服务尚未启用；三层教师提示仍可使用。"}</p>{session.entries.filter((entry) => entry.kind === "chat").map((entry) => <div className="edu-dialogue" key={entry.id}><p><b>我的问题</b>{entry.text}</p><p className="edu-ai-reply"><b>AI 学习支持</b>{entry.reply}</p><small className="edu-chat-meta">{entry.provider || "旧版供应商未记录"} / {entry.model} · {entry.promptVersion} · {entry.tokens ?? 0} tokens</small></div>)}<label htmlFor="coach-question">想进一步澄清的问题</label><textarea id="coach-question" rows={3} maxLength={1000} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={preview || !sessionAIReady || busy} /><button className="edu-button secondary" disabled={preview || !sessionAIReady || busy || !question.trim() || session.entries.filter((entry) => entry.kind === "chat").length >= 8} onClick={() => action({action:"chat",sessionId:session.id,text:question})}>{busy ? "AI 正在处理…" : "向 AI 提问"}</button><p className="edu-caption">已完成 {session.entries.filter((entry) => entry.kind === "chat").length}/8 轮。请提交你自己的修订，不以对话次数替代理解。</p></div></section>}
      {!isolated && answers.length > 0 && <section className="edu-panel"><h2>我的理解轨迹</h2>{answers.map((entry) => <article className="edu-understanding" key={entry.id}><h3>{STAGES.find((stage) => stage.id === entry.stage)?.short}</h3><p className="edu-prewrap">{entry.text}</p><small>{new Date(entry.createdAt).toLocaleString("zh-CN")}</small></article>)}{session.entries.filter((entry) => entry.kind === "feedback").map((entry) => <article className="edu-hint" key={entry.id}><strong>教师反馈</strong><p>{entry.text}</p></article>)}</section>}</section>
      {!isolated && <aside className="edu-task-aside"><section className="edu-panel"><div className="edu-section-label">概念工具箱</div>{task?.concepts.map((concept) => <details key={concept.term}><summary>{concept.term}</summary><p>{concept.text}</p></details>)}</section><section className="edu-panel"><h3>回看时检查</h3><ul>{task?.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul><p className="edu-caption">这是自我检查标准，不是系统自动给分。</p></section><section className="edu-source"><h3>材料与来源</h3><p>{task?.source}</p>{session.task.teacherNotes && <p>教师补充：{session.task.teacherNotes}</p>}</section></aside>}</div>
    </main>}
    {(error || message) && <div className={`edu-toast ${error ? "error" : ""}`} role={error ? "alert" : "status"}>{error || message}{error && session && !preview && <button onClick={() => resume(session.id)} disabled={busy}>重新读取已保存记录</button>}</div>}
  </div>;
}
