"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LearningSession, BrowserObservation } from "@/lib/education/types";
import { durationLabel } from "@/lib/education/timing";

// No per-second server writes. Observations stay numeric and tab-local until
// answer/restart, and are explicitly partial/browser-reported in the saved data.
export function useStageClock(session: LearningSession | null, serverNow?: string) {
  const [tick, setTick] = useState(0);
  const anchor = useRef({ server: Date.now(), local: 0 });
  const observation = useRef<{ key: string; last: number; hidden: boolean; observedMs: number; hiddenMs: number; interruptions: number } | null>(null);
  const key = session ? `ct-stage-clock:${session.ownerId}:${session.id}:${session.stage}` : "";
  useEffect(() => { anchor.current = { server: serverNow ? Date.parse(serverNow) : Date.now(), local: performance.now() }; setTick(n => n+1); },[serverNow]);
  const snapshot = useCallback((): BrowserObservation | undefined => {
    const o = observation.current; if (!o || o.key !== key) return;
    const now = performance.now(), delta = Math.max(0,now-o.last); o.last=now; o.observedMs+=delta; if(o.hidden)o.hiddenMs+=delta;
    const result: BrowserObservation = { observedMs: Math.floor(o.observedMs), hiddenMs: Math.floor(o.hiddenMs), interruptions: o.interruptions, source: "browser-reported-partial" };
    try { sessionStorage.setItem(key,JSON.stringify(result)); } catch { /* Storage unavailable: measurement remains partial. */ }
    return result;
  },[key]);
  useEffect(() => {
    if (!key || session?.stage === "complete" || session?.supersededBy) { observation.current=null; return; }
    let saved: Partial<BrowserObservation> = {};
    try { saved=JSON.parse(sessionStorage.getItem(key) || "{}"); } catch { /* Start a new observation segment. */ }
    const bounded=(n:unknown)=>typeof n === "number"&&Number.isFinite(n)&&n>=0?n:0;
    observation.current={ key,last:performance.now(),hidden:document.hidden,observedMs:bounded(saved.observedMs),hiddenMs:bounded(saved.hiddenMs),interruptions:bounded(saved.interruptions) };
    const visibility=()=>{ snapshot(); const o=observation.current;if(o){if(document.hidden&&!o.hidden)o.interruptions++;o.hidden=document.hidden;} };
    const interval=setInterval(()=>{setTick(n=>n+1);},1000);
    const save=setInterval(()=>{snapshot();},5000);
    document.addEventListener("visibilitychange",visibility); window.addEventListener("pagehide",snapshot);
    return ()=>{snapshot();clearInterval(interval);clearInterval(save);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",snapshot);};
  },[key,session?.stage,session?.supersededBy,snapshot]);
  void tick;
  const now = anchor.current.server + (typeof performance === "undefined" ? 0 : Math.max(0,performance.now()-anchor.current.local));
  return { now, snapshot };
}
export default function StageTimer({ session, now }: {session: LearningSession; now: number}) {
  if (session.stage === "complete" || session.supersededBy) return null;
  const timing=session.timing?.stages[session.stage], seconds=session.timing?.suggestedSeconds[session.stage];
  if (!timing?.startedAt || !seconds) return <div className="edu-timer"><strong>旧记录继续作答</strong><p>本阶段没有完整计时起点，不补算旧用时。提交后下一阶段开始提醒计时，不影响当前答题。</p></div>;
  const elapsed=Math.max(0,now-Date.parse(timing.startedAt)), remaining=seconds*1000-elapsed, overtime=remaining<=0;
  return <div className={`edu-timer ${overtime ? "overtime" : ""}`}>
    <div><strong>{overtime?"已超过建议时间":"建议时间剩余"}</strong><span role="timer" aria-live="off">{durationLabel(Math.abs(remaining))}</span></div>
    <p><span role="status">{overtime?"可以继续作答，不会自动提交或扣分。":"仅作节奏提醒，到时仍可继续作答。"}</span> 本阶段建议 {seconds/60} 分钟，已用 {durationLabel(elapsed)}。</p>
  </div>;
}
