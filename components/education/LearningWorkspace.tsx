"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ACTIVE_UNIT_IDS, COURSE, INTERVENTIONS, STAGES, TASKS, getInterventionForUnit } from "@/lib/education/course";
import { taskForDisplay } from "@/lib/education/presentation";
import { applyAnswer, applyHint } from "@/lib/education/engine";
import type { LearningSession } from "@/lib/education/types";
import CourseHeader from "./CourseHeader";
import AccessNotice from "./AccessNotice";
import { downloadJson, educationApi, EducationApiError, useEducation } from "./useEducation";
import TeachingNotice from "./TeachingNotice";

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
  const [aiWaitUntil, setAIWaitUntil] = useState(0), [clockTick, setClockTick] = useState(Date.now());
  const pending = useRef<{ signature: string; id: string } | null>(null);
  useEffect(() => { if (preview) {setSession(previewSession(unit));setText("");setQuestion("");} }, [preview, unit]);
  useEffect(() => { setConsent(Boolean(data?.consent.enabled && data.consent.noticeVersion === data.settings.noticeVersion)); }, [data]);
  useEffect(() => {
    if (!aiWaitUntil) return;
    const timer = setInterval(() => { const now = Date.now(); setClockTick(now); if (now >= aiWaitUntil) setAIWaitUntil(0); }, 1000);
    return () => clearInterval(timer);
  }, [aiWaitUntil]);
  const aiWaitSeconds = Math.max(0, Math.ceil((aiWaitUntil - clockTick) / 1000));
  const privacy = data?.settings.teachingPrivacy;
  const noticeRead = Boolean(privacy && data?.teachingAcknowledgement?.version === privacy.version);
  async function action(body: Record<string, unknown>) {
    setBusy(true); setError(""); setMessage("");
    const signature = JSON.stringify(body);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    const id = pending.current.id;
    try {
      if (!preview && ["start", "answer", "hint", "chat"].includes(String(body.action)) && !noticeRead) throw new Error("请先阅读并确认页面上方的教学记录说明；研究参与是独立选择。");
      if (body.action === "chat" && aiWaitSeconds > 0) throw new Error(`请等待 ${aiWaitSeconds} 秒后再试，问题仍保留；教师提示可继续使用。`);
      if (preview && session) {
        if (body.action === "answer") setSession(applyAnswer(session, { id, stage: body.stage, text: body.text }, new Date().toISOString()));
        if (body.action === "hint") setSession(applyHint(session, id, new Date().toISOString()));
      } else {
        const result = await educationApi<{ session?: LearningSession }>("", { ...body, requestId: id });
        if (result.session) setSession(result.session);
        else { await refresh(); setMessage(body.action === "consent" ? "研究使用选择已更新。退出后，之后的研究读取与导出将排除你的历史记录；已合法导出的副本需联系研究负责人处理。" : body.action === "acknowledgeTeachingNotice" ? "已确认教学记录说明。研究参与仍由你单独自愿选择。" : "已加入课程。"); }
      }
      pending.current = null;
      if (body.action === "answer") setText("");
      if (body.action === "chat") setQuestion("");
    } catch (err) { setError(err instanceof Error ? err.message : "操作失败。"); if (body.action === "chat" && err instanceof EducationApiError && err.retryAfter > 0) { setClockTick(Date.now()); setAIWaitUntil(Date.now() + err.retryAfter * 1000); } }
    finally { setBusy(false); }
  }
  async function resume(id: string) { setBusy(true); setError(""); try { const result = await educationApi<{session: LearningSession}>(`?session=${encodeURIComponent(id)}`); setSession(result.session); setText(""); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  const task = session ? taskForDisplay(session.task.task) : undefined, currentStage = session?.stage === "complete" ? null : session?.stage;
  const answers = session?.entries.filter((entry) => entry.kind === "answer") ?? [];
  const hints = session?.entries.filter((entry) => entry.kind === "hint") ?? [];
  const isolated = session?.stage === "initial" || session?.stage === "transfer";
  const mismatch = data && data.user.role !== "student";
  const sessionAIReady = session?.ai ? Boolean(data?.aiAvailability[session.ai.provider]) : Boolean(data?.aiEnabled);
  return <div className="edu-app"><CourseHeader active="student" />{preview && <div className="edu-preview-banner"><strong>任务预览</strong> · 提示由教师编写，输入不会保存，也不会产生研究数据。<Link href="/student">进入正式学习 →</Link></div>}
    {!preview && data?.user.role === "student" && <div className="edu-notice-strip"><TeachingNotice key={privacy?.version ?? 0} privacy={privacy} acknowledged={noticeRead} busy={busy} onAcknowledge={() => action({ action: "acknowledgeTeachingNotice", version: privacy?.version, acknowledged: true })} />{aiWaitSeconds > 0 && <div className="edu-callout" role="status">答疑暂时繁忙，{aiWaitSeconds} 秒后可重试。不会自动重发；你的问题保留，教师提示仍可使用。</div>}</div>}
    {!preview && (!data || mismatch) ? <AccessNotice loading={loading} error={accessError} mismatch={mismatch ? "此页面供学生使用；教师可从工作台预览同样的学习流程。" : ""} onRetry={refresh} /> : !session ? <main className="edu-page"><div className="edu-page-heading"><div><div className="edu-eyebrow">我的学习 / {COURSE.id}</div><h1>我的课程学习</h1><p>先选择一个已发布的任务，或继续之前的学习。</p></div><Link className="edu-button secondary" href="/">回到五次活动</Link></div>
      {!data?.member && <section className="edu-panel"><h2>加入教育心理学课程</h2><p>使用教师发放的邀请码加入。注册账号不代表已经加入课程。</p><label htmlFor="join-code">课程邀请码</label><div className="edu-inline-form"><input id="join-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} autoComplete="off" /><button className="edu-button" disabled={busy || !code.trim()} onClick={() => action({action:"join",code})}>加入课程</button></div></section>}
      <p className="edu-caption">当前学习 ID：{data?.user.learnerCode}。五次活动与聊天记录均归于这个身份；如 ID 不属于你，请到课程登录页退出并切换。</p>
      {!data?.classroomEnabled && <div className="edu-callout">正式课堂尚未开放。你可以预览前两次任务，教师审核任务并开启课堂后再开始保存学习记录。</div>}
      <section className="edu-two-col">{INTERVENTIONS.map((item) => {
        const id = item.unitId;
        const config = id ? data?.configs.find((value) => value.task.unitId === id && value.published && value.interventionId === item.id) : undefined;
        return <article className={`edu-panel ${item.ready ? "" : "edu-pending-card"}`} key={item.id}>
          <div className="edu-eyebrow">活动 {item.id} {id ? `· 单元 ${id} · 第 ${config?.scheduledWeek ?? item.week} 周` : "· 待选讲义"}</div>
          <h2>{item.title}</h2><p>{config?.task.objective || (id ? TASKS[id].objective : item.focus)}</p>
          {id ? <><p className="edu-caption">{config ? "教师已发布" : "待教师审核发布新的活动版本"}</p><label htmlFor={`language-${id}`}>我的主要学习语言</label><select id={`language-${id}`} value={language} onChange={(e) => setLanguage(e.target.value)}>{["英语","日语","俄语","法语","德语","其他语言"].map((name) => <option key={name}>{name}</option>)}</select><div className="edu-actions"><button className="edu-button" disabled={!config || !data?.member || !data.classroomEnabled || busy} onClick={() => action({action:"start",unitId:id,language})}>开始 / 继续学习 →</button><Link className="edu-text-link" href={`/preview?unit=${id}`}>任务预览</Link></div></> : <p className="edu-caption">尚未开放，不生成占位学习记录。</p>}
        </article>;
      })}</section>
      <section className="edu-panel"><h2>已保存的学习记录</h2>{!data?.sessions.length ? <p className="edu-muted">还没有记录。提交每个学习阶段后，内容会保存到课程账号。</p> : <div className="edu-record-list">{data.sessions.map((item) => <button key={item.id} onClick={() => resume(item.id)} disabled={busy}><span>{item.interventionId ? `活动 ${item.interventionId}` : "旧版学习"} · 单元 {item.unitId} · {item.stage === "complete" ? "理解记录已完成" : STAGES.find((stage) => stage.id === item.stage)?.short}</span><small>第 {item.scheduledWeek} 周 · {new Date(item.updatedAt).toLocaleString("zh-CN")}</small><span>查看 →</span></button>)}</div>}</section>
      <section className="edu-panel"><h2>学习记录与研究使用</h2><p>正式学习会保存你的回答、提示使用、答疑对话与教师反馈，用于课程支持。请不要填写真实第三方姓名、联系方式或敏感个人经历。学习答疑由智能辅助生成，可能有误，不是教师本人回复。答疑所需的任务材料、近期对话和问题会由指定服务商处理，详情见教学记录说明。自动遮蔽邮箱和部分手机号不能保证匿名，请自行去除个人信息。</p>{data?.settings.researchEnabled ? <><p className="edu-prewrap">{data.settings.consentNotice}</p><p className="edu-caption">方案：{data.settings.researchProtocol} · 告知版本 {data.settings.noticeVersion}</p><label className="edu-check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />我自愿允许按以上告知，将课程记录用于研究。不同意或退出不影响课程学习。</label><button className="edu-button secondary" disabled={busy} onClick={() => action({action:"consent",enabled:consent,noticeVersion:data.settings.noticeVersion})}>保存我的选择</button></> : <p className="edu-caption">研究授权尚未启用。目前仅保存教学记录，研究端不会获得这些记录。</p>}</section>
    </main> : <main className="edu-workspace"><div className="edu-workspace-heading"><div><div className="edu-eyebrow">{session.interventionId ? `活动 ${session.interventionId}` : "旧版学习"} / 第 {session.task.scheduledWeek} 周 / {session.language}学习</div><h1>{task?.title}</h1></div><button className="edu-button secondary" disabled={busy} onClick={() => { if (preview) { setSession(previewSession(unit)); setText(""); setQuestion(""); } else { setSession(null); void refresh(); } }}>{preview ? "重新预览" : "返回学习记录"}</button></div>
      <ol className="edu-steps">{STAGES.map((stage,index) => <li key={stage.id} className={currentStage === stage.id ? "current" : answers.some((entry) => entry.stage === stage.id) ? "done" : ""}><b>{answers.some((entry) => entry.stage === stage.id) ? "✓" : String(index+1).padStart(2,"0")}</b><span>{stage.short}</span></li>)}</ol>
      <div className={`edu-task-grid ${isolated ? "independent" : ""}`}><section className="edu-task-main"><div className="edu-panel"><div className="edu-section-label">{currentStage === "transfer" ? "新情境 · 独立尝试" : "学习案例"}</div><p className="edu-case">{currentStage === "transfer" ? task?.prompts.transfer : task?.caseText}</p>{currentStage && <><h2>{STAGES.find((stage) => stage.id === currentStage)?.title}</h2>{currentStage !== "transfer" && <p>{task?.prompts[currentStage]}</p>}<label htmlFor="learner-answer">你的{currentStage === "reflection" ? "理解记录" : "解释"}</label><textarea id="learner-answer" value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} placeholder="请用自己的语言写下解释；保留不确定的地方也可以。" rows={7} disabled={busy} /><div className="edu-submit-row"><span className="edu-caption">{text.length}/5000 · {preview ? "预览内容不会保存" : "提交后保存；未提交文字仅保留在本页"}</span><button className="edu-button" disabled={busy || !text.trim()} onClick={() => action({action:"answer",sessionId:session.id,stage:currentStage,text})}>{busy ? "正在处理…" : currentStage === "reflection" ? "确认并保存理解记录" : "提交，进入下一步 →"}</button></div>{isolated && <p className="edu-caption">本阶段先独立完成。概念卡与提示暂时收起；这是学习检查，不是受监考考试。</p>}</>}
      {session.stage === "complete" && <div className="edu-complete"><div className="edu-eyebrow">四个阶段已完成</div><h2>你留下了一次可回看的理解变化</h2><p>完成记录不等于已经掌握。可以回看不同版本，带着仍未解决的问题参与课堂。</p><button className="edu-button secondary" onClick={() => downloadJson(`我的理解-单元${session.unitId}.json`,{course:COURSE.id,courseVersion:session.courseVersion,interventionId:session.interventionId,scheduledWeek:session.task.scheduledWeek,unitId:session.unitId,taskVersion:session.task.version,ai:session.ai,preview,entries:session.entries})}>导出我的学习记录</button></div>}</div>
      {session.stage === "revision" && <section className="edu-panel"><div className="edu-panel-title"><h2>需要一点支持？</h2><span className="edu-caption">已展开 {hints.length}/3 层</span></div>{hints.map((entry) => <div className="edu-hint" key={entry.id}><strong>提示 {entry.level} · {entry.level === 1 ? "方向提醒" : entry.level === 2 ? "概念支持" : "部分示范"}</strong><p>{entry.text}</p></div>)}<button className="edu-button secondary" disabled={busy || hints.length >= 3} onClick={() => action({action:"hint",sessionId:session.id})}>{hints.length ? "再多一点提示" : "给我一个方向提示"}</button><div className="edu-chat"><h3>围绕这次解释提问</h3><p className="edu-caption">{preview ? "预览可查看教师提示，正式课堂开放后可以使用学习答疑。" : sessionAIReady ? "答疑用于解释和追问，不代写作业。回复由智能辅助生成，可能有误，请对照讲义核查。" : "学习答疑暂未启用，三层教师提示仍可使用。"}</p>{session.entries.filter((entry) => entry.kind === "chat").map((entry) => <div className="edu-dialogue" key={entry.id}><p><b>我的问题</b>{entry.text}</p><p className="edu-ai-reply"><b>答疑提示</b>{entry.reply}</p><small className="edu-chat-meta">{new Date(entry.createdAt).toLocaleString("zh-CN")}</small></div>)}<label htmlFor="coach-question">想进一步澄清的问题</label><textarea id="coach-question" rows={3} maxLength={1000} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={preview || !sessionAIReady || busy} /><button className="edu-button secondary" disabled={preview || !sessionAIReady || busy || aiWaitSeconds > 0 || !question.trim() || session.entries.filter((entry) => entry.kind === "chat").length >= 8} onClick={() => action({action:"chat",sessionId:session.id,text:question})}>{busy ? "正在整理答疑…" : aiWaitSeconds > 0 ? `${aiWaitSeconds} 秒后可重试` : "发送问题"}</button><p className="edu-caption">已完成 {session.entries.filter((entry) => entry.kind === "chat").length}/8 轮。请提交你自己的修订，不以对话次数替代理解。</p></div></section>}
      {!isolated && answers.length > 0 && <section className="edu-panel"><h2>我的理解轨迹</h2>{answers.map((entry) => <article className="edu-understanding" key={entry.id}><h3>{STAGES.find((stage) => stage.id === entry.stage)?.short}</h3><p className="edu-prewrap">{entry.text}</p><small>{new Date(entry.createdAt).toLocaleString("zh-CN")}</small></article>)}{session.entries.filter((entry) => entry.kind === "feedback").map((entry) => <article className="edu-hint" key={entry.id}><strong>教师反馈</strong><p>{entry.text}</p></article>)}</section>}</section>
      {!isolated && <aside className="edu-task-aside"><section className="edu-panel"><div className="edu-section-label">概念工具箱</div>{task?.concepts.map((concept) => <details key={concept.term}><summary>{concept.term}</summary><p>{concept.text}</p></details>)}</section><section className="edu-panel"><h3>回看时检查</h3><ul>{task?.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul><p className="edu-caption">这是自我检查标准，不是系统自动给分。</p></section><section className="edu-source"><h3>材料与来源</h3><p>{task?.source}</p>{session.task.teacherNotes && <p>教师补充：{session.task.teacherNotes}</p>}</section></aside>}</div>
    </main>}
    {(error || message) && <div className={`edu-toast ${error ? "error" : ""}`} role={error ? "alert" : "status"}>{error || message}{error && session && !preview && <button onClick={() => resume(session.id)} disabled={busy}>重新读取已保存记录</button>}</div>}
  </div>;
}
