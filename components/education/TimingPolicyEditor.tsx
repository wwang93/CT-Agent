"use client";
import { useEffect, useState } from "react";
import { STAGES, type Stage } from "@/lib/education/course";
import { DEFAULT_STAGE_SECONDS } from "@/lib/education/timing";
import type { CourseSettings } from "@/lib/education/types";
import { educationApi } from "./useEducation";
export default function TimingPolicyEditor({current,onSaved}:{current?:CourseSettings["timingPolicy"];onSaved:()=>Promise<void>}) {
  const [seconds,setSeconds]=useState({...DEFAULT_STAGE_SECONDS}),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{setSeconds({...current?.suggestedSeconds??DEFAULT_STAGE_SECONDS});},[current]);
  async function save(){setBusy(true);setMessage("");try{await educationApi("",{action:"timingPolicy",suggestedSeconds:seconds});await onSaved();setMessage("建议用时已保存，仅用于之后新建的作答；已有作答不变。");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  return <section className="edu-panel"><h2>提醒计时与重做规则</h2><p>首次作答 1 次，另有 1 次重做机会，跨设备累计。第二次活动统一按最新题目版本计次，旧版不占新版机会；第一活动仍累计原有次数。旧记录全部保留，倒计时结束不限制提交、不自动扣分。</p><div className="edu-form-grid">{STAGES.map(s=><label key={s.id}>{s.short}建议用时（分钟）<input type="number" min={1} max={120} step={1} value={seconds[s.id]/60} onChange={e=>setSeconds(old=>({...old,[s.id as Stage]:Number(e.target.value)*60}))}/></label>)}</div><button className="edu-button secondary" disabled={busy||Object.values(seconds).some(n=>!Number.isInteger(n/60)||n<60||n>7200)} onClick={()=>void save()}>保存建议用时</button><p className="edu-caption">调整只影响新建的作答，不重置当前学生计时，也不会改写已发布任务。</p>{message&&<p role="status">{message}</p>}</section>;
}
