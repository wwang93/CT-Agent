import { STAGES } from "@/lib/education/course";
import type { LearningSession } from "@/lib/education/types";
import { durationLabel } from "@/lib/education/timing";

export default function TimingReport({ session }: {session: LearningSession}) {
  const draft=session.savedRestartDraft;
  return <section className="edu-timing-report"><h3>作答次数与阶段用时</h3>
    <p>{session.attemptNumber ? `第 ${session.attemptNumber} 次作答` : "历史作答"}{session.restartOf?"（重做）":""}{session.supersededBy?` · ${session.stage==="complete"?"已完成，之后重新作答":"中途结束，原记录保留"}`:""} · 任务 v{session.task.version}</p>
    <div className="edu-table-wrap"><table><thead><tr><th>阶段</th><th>开始 / 提交或结束</th><th>建议</th><th>实际经过</th><th>超时</th><th>页面中断</th></tr></thead><tbody>{STAGES.map(stage=>{const t=session.timing?.stages[stage.id],end=t?.submittedAt||t?.endedAt||session.entries.find(e=>e.kind==="answer"&&e.stage===stage.id)?.createdAt;return <tr key={stage.id}><td>{stage.short}</td><td>{t?.startedAt ? new Date(t.startedAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false}) : "起点未记录"}<br/>{end ? new Date(end).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false}) : "尚未提交或未记录"}</td><td>{session.timing?`${session.timing.suggestedSeconds[stage.id]/60} 分钟`:"未记录"}</td><td>{t?.startedAt&&!end?"进行中":durationLabel(t?.elapsedMs)}{t?.missingStart?"（缺少起点）":""}</td><td>{durationLabel(t?.overrunMs)}</td><td>{t?.observation?`${t.observation.interruptions} 次 / ${durationLabel(t.observation.hiddenMs)}`:"未记录"}</td></tr>;})}</tbody></table></div>
    <p className="edu-caption">实际经过时间按服务端时间计算，不代表有效思考时长。中断为浏览器报告的部分观测，不读取其他页面内容。旧记录不补造计时，重做不能作为未经支持的首次表现。</p>
    {draft&&(draft.answerDraft||draft.questionDraft)&&<details><summary>重做前保存的未提交草稿（不计作正式回答）</summary>{draft.answerDraft&&<><h4>回答草稿</h4><p className="edu-prewrap">{draft.answerDraft}</p></>}{draft.questionDraft&&<><h4>未发送的问题</h4><p className="edu-prewrap">{draft.questionDraft}</p></>}</details>}
  </section>;
}
