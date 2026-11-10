import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { ACTIVE_UNIT_IDS, COURSE, INTERVENTIONS, STAGES, TASKS, UNITS } from "../lib/education/course";
import { actionId, applyAnswer, applyHint, assertOwner, assertUnlocked, redactText, sessionSummary, unitId, validateTask } from "../lib/education/engine";
import type { LearningSession } from "../lib/education/types";
import { analytics, loadSession, overview, performAction } from "../lib/education/service";
import { readRecord, writeRecord } from "../lib/education/store";
import { requireAuthenticatedUser } from "../lib/auth-server";
import { acquireAIPermit, releaseAIPermit, AICapacityError } from "../lib/education/ai-capacity";
import { attemptViews, browserObservation, DEFAULT_STAGE_SECONDS, newTiming, timingTotals } from "../lib/education/timing";

const now = "2026-09-04T12:00:00.000Z";
const fresh = (): LearningSession => ({id:"sample",ownerId:"student-a",unitId:6,task:{task:structuredClone(TASKS[6]),version:1,published:true,scheduledWeek:6,teacherNotes:"",reviewedAt:now,reviewedBy:"teacher"},stage:"initial",entries:[],language:"英语",createdAt:now,updatedAt:now});
test("five interventions preserve course hours, align Week 7/10 and retain the legacy task", () => {
  assert.equal(UNITS.length,15); assert.equal(UNITS.reduce((sum,unit)=>sum+unit.hours,0),32);
  assert.equal(COURSE.hours,32); assert.equal(INTERVENTIONS.length,5); assert.deepEqual(ACTIVE_UNIT_IDS,[6,10]);
  assert.deepEqual(INTERVENTIONS.filter((item)=>item.ready).map((item)=>[item.id,item.week,item.unitId]),[[1,7,6],[2,10,10]]);
  assert.ok(INTERVENTIONS.slice(2).every((item)=>!item.ready && !item.unitId && !item.week));
  for(const id of ACTIVE_UNIT_IDS) assert.deepEqual(validateTask(TASKS[id],id),TASKS[id]);
  assert.ok(TASKS[9],"legacy source retained for existing histories");
  assert.throws(()=>unitId(9));assert.throws(()=>unitId(3));
  assert.equal(sessionSummary(fresh()).interventionId,undefined,"legacy records are not relabeled as interventions");
  for(const concept of ["注意","认知负荷","意义编码","提取"]) assert.ok(TASKS[6].prompts.revision.includes(concept));
  for(const move of ["初始判断","批判性评价","创造性生成","选择与修订"]) assert.ok(TASKS[10].prompts.revision.includes(move));
});
test("four stage transitions are sequential, append-only and retry-idempotent", () => {
  let session=fresh();
  assert.throws(()=>applyAnswer(session,{id:crypto.randomUUID(),stage:"transfer",text:"skip"},now));
  for(const stage of STAGES) {const id=crypto.randomUUID();const old=session;session=applyAnswer(session,{id,stage:stage.id,text:`我的${stage.id}解释`},now);assert.equal(old.entries.length,session.entries.length-1);assert.strictEqual(applyAnswer(session,{id,stage:stage.id,text:"retry"},now),session);}
  assert.equal(session.stage,"complete");assert.equal(session.entries.length,4);
  assert.throws(()=>applyAnswer(session,{id:crypto.randomUUID(),stage:"reflection",text:"again"},now));
});
test("Week 10 teacher revision separates the two-solution revision from one-solution transfer without changing timer defaults", () => {
  const task = validateTask(TASKS[10], 10);
  assert.ok(task.caseText.includes("语法正确、请求也表述清楚"));
  assert.ok(task.caseText.includes("语气有些生硬"));
  for (const question of ["①你观察到的问题是什么", "②双方产生的矛盾点是什么", "③你想到的第一方案是什么", "④你的方案基于哪些假设和条件", "⑤还缺少哪些信息"]) assert.ok(task.prompts.initial.includes(question));
  assert.equal((task.prompts.initial.match(/④/g) ?? []).length, 1);
  assert.ok(task.prompts.initial.includes("不需要改写邮件"));
  assert.ok(!task.prompts.initial.includes("两种不同的问题表征"));
  assert.ok(task.prompts.revision.includes("至少两个不同方案"));
  assert.ok(task.prompts.revision.includes("⑤最后标明改变了什么"));
  assert.ok(task.prompts.transfer.includes("可能因"), "the missing details are a possible explanation, not proven cause");
  assert.ok(task.prompts.transfer.includes("重新表述问题，生成一个解决方案"));
  assert.ok(task.prompts.transfer.includes("比较你的方案和上一个案例的改进方案"));
  assert.ok(!task.prompts.transfer.includes("至少两个"));
  assert.ok(!task.prompts.reflection.includes("答疑答疑"));
  assert.ok(!task.criteria.some(c => c.includes("两种问题表征")));
  assert.ok(task.criteria.some(c => c.startsWith("解释与修订阶段") && c.includes("至少两个")));
  assert.ok(task.criteria.some(c => c.startsWith("独立迁移阶段提出一个方案")));
  assert.deepEqual(DEFAULT_STAGE_SECONDS, {initial:360, revision:600, transfer:480, reflection:240});
});
test("hints are limited to three and unavailable in independent stages", () => {
  let session=fresh(); assert.throws(()=>applyHint(session,crypto.randomUUID(),now));
  session=applyAnswer(session,{id:crypto.randomUUID(),stage:"initial",text:"初答"},now);
  for(let level=1;level<=3;level++) {const id=crypto.randomUUID();session=applyHint(session,id,now);assert.equal(session.entries.at(-1)?.level,level);assert.strictEqual(applyHint(session,id,now),session);}
  assert.throws(()=>applyHint(session,crypto.randomUUID(),now));
  session=applyAnswer(session,{id:crypto.randomUUID(),stage:"revision",text:"修订"},now);assert.throws(()=>applyHint(session,crypto.randomUUID(),now));
});
test("ownership, lock expiry, text validation and UUID validation", () => {
  const session=fresh();assert.throws(()=>assertOwner(session,"student-b"));assert.doesNotThrow(()=>assertOwner(session,"student-a"));
  session.pending={id:crypto.randomUUID(),startedAt:now};assert.throws(()=>assertUnlocked(session,Date.parse(now)+1000));assert.doesNotThrow(()=>assertUnlocked(session,Date.parse(now)+91000));
  assert.throws(()=>actionId("-".repeat(36)));assert.equal(actionId(crypto.randomUUID()).length,36);
  assert.throws(()=>applyAnswer(fresh(),{id:crypto.randomUUID(),stage:"initial",text:"  "},now));
  assert.throws(()=>applyAnswer(fresh(),{id:crypto.randomUUID(),stage:"initial",text:"a".repeat(5001)},now));
  assert.throws(()=>validateTask({...TASKS[6],hints:["one"]},6));
  assert.throws(()=>validateTask({...TASKS[6],prompts:{}},6));
});
test("research text redaction covers email and mainland mobile without claiming anonymity", () => {
  const redacted=redactText("例子 test@example.com 13812345678 张同学");
  assert.ok(!redacted.includes("test@example.com"));assert.ok(!redacted.includes("13812345678"));assert.ok(redacted.includes("张同学"));
});
test("soft timer records real overruns without blocking late answers and never fabricates legacy starts", () => {
  const start="2026-11-08T12:00:00.000Z", end="2026-11-08T12:08:00.000Z";
  const s={...fresh(),createdAt:start,timing:newTiming(start)};
  const next=applyAnswer(s,{id:crypto.randomUUID(),stage:"initial",text:"超时仍提交",observation:{observedMs:999999999,hiddenMs:999999999,interruptions:3}},end);
  assert.equal(next.stage,"revision");assert.equal(next.timing?.stages.initial?.elapsedMs,480000);assert.equal(next.timing?.stages.initial?.overrunMs,120000);
  assert.equal(next.timing?.stages.initial?.observation?.observedMs,480000);assert.equal(next.timing?.stages.revision?.startedAt,end);
  assert.equal(s.entries.length,0);assert.equal(s.timing.stages.initial?.submittedAt,undefined);
  const legacy=applyAnswer(fresh(),{id:crypto.randomUUID(),stage:"initial",text:"旧页面无计时字段照常提交"},end);
  assert.equal(legacy.timing?.stages.initial?.elapsedMs,undefined);assert.equal(legacy.timing?.stages.initial?.missingStart,true);
  assert.equal(legacy.timing?.stages.revision?.startedAt,end);assert.equal(timingTotals(legacy).timingCoverage,"none");
  assert.equal(browserObservation({observedMs:-1,hiddenMs:0,interruptions:0},500),undefined);
});

// HTTP/Postgres client double. No production database or real model is called.
type Row = Record<string, any>;
function fakeDatabase() {
  const tables: Record<string, Row[]>={course_templates:[],profiles:[]};
  return {tables, auth:{getUser:async(token:string)=>token==="valid-token" ? {data:{user:{id:"new-user",user_metadata:{role:"instructor"}}},error:null} : {data:{user:null},error:{message:"invalid"}}}, from(table:string) {
    let filters: ((row:Row)=>boolean)[]=[],operation="read",payload:Row={},range=[0,Infinity],sort="";
    const query:any={select:()=>query,eq:(key:string,value:any)=>{filters.push((row)=>row[key]===value);return query;},like:(key:string,value:string)=>{filters.push((row)=>String(row[key]).startsWith(value.slice(0,-1)));return query;},order:(key:string)=>{sort=key;return query;},range:(a:number,b:number)=>{range=[a,b];return query;},insert:(value:Row)=>{operation="insert";payload=value;return query;},update:(value:Row)=>{operation="update";payload=value;return query;},upsert:(value:Row)=>{operation="upsert";payload=value;return query;},maybeSingle:()=>execute(true),single:()=>execute(true),then:(resolve:any,reject:any)=>execute(false).then(resolve,reject)};
    async function execute(single:boolean) {
      let rows=tables[table]??=[];
      if(operation==="insert" || operation==="upsert") {
        const index=rows.findIndex((row)=>table==="profiles" ? row.user_id===payload.user_id : row.course_id===payload.course_id && row.week_number===payload.week_number && row.assignment_id===payload.assignment_id);
        if(index>=0 && operation==="insert") return {data:null,error:{code:"23505"}};
        const value=structuredClone(payload);if(index>=0) rows[index]=value;else rows.push(value);return {data:single?value:[value],error:null};
      }
      rows=rows.filter((row)=>filters.every((filter)=>filter(row)));
      if(operation==="update") rows.forEach((row)=>Object.assign(row,structuredClone(payload)));
      if(sort) rows.sort((a,b)=>String(a[sort]).localeCompare(String(b[sort])));
      rows=rows.slice(range[0],range[1]+1);
      return {data:structuredClone(single ? rows[0]??null : rows),error:null};
    }
    return query;
  }};
}
test("server workflow enforces roles, snapshots, consent, AI auditing and optimistic concurrency", async (t) => {
  const fake=fakeDatabase();
  const originalFetch=globalThis.fetch;
  const keys=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","EDU_CLASSROOM_ENABLED","DEEPSEEK_API_KEY","OPENAI_API_KEY","EDU_AI_PROVIDER","DEEPSEEK_MODEL","EDU_AI_MAX_CONCURRENT","EDU_AI_DAILY_REQUEST_LIMIT"];
  const originalEnv=Object.fromEntries(keys.map((key)=>[key,process.env[key]]));
  t.after(()=>{globalThis.fetch=originalFetch;for(const key of keys) {if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];} delete (globalThis as any).__CT_AGENT_SUPABASE_SERVER__;});
  process.env.SUPABASE_URL="https://test.invalid";process.env.SUPABASE_SERVICE_ROLE_KEY="test-only";process.env.EDU_CLASSROOM_ENABLED="true";
  process.env.EDU_AI_PROVIDER="deepseek";delete process.env.DEEPSEEK_API_KEY;delete process.env.OPENAI_API_KEY;delete process.env.DEEPSEEK_MODEL;
  delete process.env.EDU_AI_MAX_CONCURRENT;delete process.env.EDU_AI_DAILY_REQUEST_LIMIT;
  (globalThis as any).__CT_AGENT_SUPABASE_SERVER__=fake;
  const teacher={userId:"teacher",role:"instructor" as const},student={userId:"student-a",role:"student" as const},other={userId:"student-b",role:"student" as const},researcher={userId:"research",role:"researcher" as const};
  await assert.rejects(()=>requireAuthenticatedUser(new Request("http://localhost/api/education")));
  const newUser=await requireAuthenticatedUser(new Request("http://localhost/api/education",{headers:{Authorization:"Bearer valid-token"}}));
  assert.equal(newUser.role,"student","untrusted signup role must not elevate permissions");
  await assert.rejects(()=>performAction(student,{action:"invite"}));
  await assert.rejects(()=>performAction(student,{action:"start",unitId:6,requestId:crypto.randomUUID()}));
  const invite=await performAction(teacher,{action:"invite"}) as {code:string};
  await assert.rejects(()=>performAction(student,{action:"join",code:"bad-code"}));
  await performAction(student,{action:"join",code:invite.code});
  await assert.rejects(()=>performAction(student,{action:"start",unitId:6,requestId:crypto.randomUUID()}),/教师尚未确认/);
  const privacy={action:"teachingPrivacy",notice:"测试课程教学记录说明，不作为研究参与同意。",contact:"测试教师，课堂内联系",retention:"测试结束即清理，不涉及真实学生",reviewed:true};
  await assert.rejects(()=>performAction(student,privacy));
  await assert.rejects(()=>performAction(teacher,{...privacy,reviewed:false}));
  await assert.rejects(()=>performAction(teacher,{...privacy,contact:"待填写"}));
  await performAction(teacher,privacy);
  await assert.rejects(()=>performAction(student,{action:"start",unitId:6,requestId:crypto.randomUUID()}),/阅读并确认/);
  await assert.rejects(()=>performAction(student,{action:"acknowledgeTeachingNotice",version:0,acknowledged:true}));
  await performAction(student,{action:"acknowledgeTeachingNotice",version:1,acknowledged:true});
  const publish={action:"publish",unitId:6,expectedVersion:0,scheduledWeek:4,reviewed:true,published:true,task:TASKS[6]};
  await assert.rejects(()=>performAction(student,publish));await performAction(teacher,publish);
  await assert.rejects(()=>performAction(teacher,publish),/任务已被更新/);
  const start={action:"start",unitId:6,requestId:crypto.randomUUID(),language:"英语"};
  const started=await performAction(student,start) as {session:LearningSession};const id=started.session.id;
  assert.equal(started.session.interventionId,1);assert.equal(started.session.task.scheduledWeek,4,"teacher schedule is distinct from intervention/unit");
  assert.deepEqual(started.session.ai,{provider:"deepseek",model:"deepseek-flash",thinking:"disabled"});
  const repeated=await performAction(student,start) as {session:LearningSession};assert.equal(repeated.session.id,id);
  await assert.rejects(()=>loadSession(other,id));await assert.rejects(()=>loadSession(researcher,id));
  assert.equal((await overview(other)).sessions.length,0);
  await performAction(teacher,{...publish,expectedVersion:1,task:{...TASKS[6],title:"新版案例"}});
  assert.equal((await loadSession(student,id)).value.task.version,1,"in-flight task keeps its published snapshot");
  await assert.rejects(()=>performAction(student,{action:"hint",sessionId:id,requestId:crypto.randomUUID()}));
  for(const stage of STAGES) {
    await performAction(student,{action:"answer",sessionId:id,stage:stage.id,text:`${stage.id} learner@example.com`,requestId:crypto.randomUUID()});
    if(stage.id==="initial") {
      await performAction(student,{action:"hint",sessionId:id,requestId:crypto.randomUUID()});
      await assert.rejects(()=>performAction(student,{action:"chat",sessionId:id,text:"问题",requestId:crypto.randomUUID()}),/尚未启用/);
      let requests=0,fail=false;
      process.env.DEEPSEEK_API_KEY="fake-test-key";process.env.EDU_AI_PROVIDER="openai";process.env.OPENAI_API_KEY="fake-backup-key";
      globalThis.fetch=async(url,init)=>{
        requests++;assert.equal(String(url),"https://api.deepseek.com/chat/completions","session provider remains pinned after runtime switch");
        assert.ok(!String(init?.body).includes(TASKS[6].prompts.transfer));
        if(fail) throw new Error("test outage");
        return new Response(JSON.stringify({id:"mock",model:"deepseek-flash-served-test",choices:[{index:0,message:{role:"assistant",content:"哪条观察支持你的解释？"},finish_reason:"stop"}],usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}}),{headers:{"Content-Type":"application/json"}});
      };
      const chat={action:"chat",sessionId:id,text:"我缺少哪些证据？",requestId:crypto.randomUUID()};
      const answered=await performAction(student,chat) as {session:LearningSession};
      assert.equal(answered.session.entries.at(-1)?.provider,"deepseek");assert.equal(answered.session.entries.at(-1)?.servedModel,"deepseek-flash-served-test");
      await performAction(student,chat);assert.equal(requests,1,"successful retries are idempotent");
      const retry={...chat,requestId:crypto.randomUUID()};fail=true;
      await assert.rejects(()=>performAction(student,retry),/暂时不可用/);
      const failed=(await loadSession(student,id)).value;
      assert.equal(failed.pending,undefined);assert.equal(failed.entries.at(-1)?.kind,"ai_error");assert.equal(failed.entries.at(-1)?.requestId,retry.requestId);
      fail=false;await performAction(student,retry);assert.equal(requests,3,"failed requests can retry without silent provider fallback");
      process.env.EDU_AI_MAX_CONCURRENT="1";
      const permit=await acquireAIPermit("capacity-fixture"), before=(await loadSession(student,id)).value;
      await assert.rejects(()=>performAction(student,{...chat,requestId:crypto.randomUUID()}),AICapacityError);
      assert.equal(requests,3,"capacity rejection does not call the model");
      assert.deepEqual((await loadSession(student,id)).value,before,"capacity rejection does not add an error/chat round or session lock");
      await releaseAIPermit(permit);delete process.env.EDU_AI_MAX_CONCURRENT;
      globalThis.fetch=originalFetch;delete process.env.DEEPSEEK_API_KEY;delete process.env.OPENAI_API_KEY;process.env.EDU_AI_PROVIDER="deepseek";
    }
    if(stage.id==="revision") await assert.rejects(()=>performAction(student,{action:"chat",sessionId:id,text:"帮我回答迁移题",requestId:crypto.randomUUID()}),/仅在解释与修订/);
  }
  await performAction(teacher,{action:"feedback",sessionId:id,text:"请补充案例证据",requestId:crypto.randomUUID()});
  assert.equal((await overview(student)).sessions.length,1,"teacher feedback does not change ownership");
  assert.equal((await analytics(teacher,false)).completed,1);
  assert.equal((await analytics(teacher,false)).chats,2);assert.equal((await analytics(teacher,false)).aiErrors,1);
  assert.equal((await analytics(teacher,false)).interventions[0].completed,1);
  await assert.rejects(()=>analytics(student,false));await assert.rejects(()=>analytics(teacher,true));
  assert.equal((await analytics(researcher,true,true)).total,0);
  await performAction(teacher,{action:"settings",researchEnabled:true,researchProtocol:"test-protocol",consentNotice:"测试告知",approved:true});
  await assert.rejects(()=>performAction(student,{action:"consent",enabled:true,noticeVersion:0}));
  const noticeVersion=(await overview(student)).settings.noticeVersion;
  await performAction(student,{action:"consent",enabled:true,noticeVersion});
  const exported=await analytics(researcher,true,true);assert.equal(exported.total,1);
  assert.ok(JSON.stringify(exported).includes('"scheduledWeek":4'));assert.ok(JSON.stringify(exported).includes('"provider":"deepseek"'));
  assert.ok(!JSON.stringify(exported).includes("student-a"));assert.ok(!JSON.stringify(exported).includes("learner@example.com"));
  process.env.EDU_CLASSROOM_ENABLED="false";
  await performAction(student,{action:"consent",enabled:false,noticeVersion});
  assert.equal((await analytics(researcher,true,true)).total,0,"withdrawal works even after classroom closes");
  await assert.rejects(()=>performAction(other,{action:"join",code:invite.code}),/尚未开放/);
  process.env.EDU_CLASSROOM_ENABLED="true";
  await performAction(other,{action:"join",code:invite.code});
  await performAction(other,{action:"acknowledgeTeachingNotice",version:1,acknowledged:true});
  const simultaneous=await Promise.all(Array.from({length:10},()=>performAction(other,{action:"start",unitId:6,requestId:crypto.randomUUID(),language:"英语"}))) as {session:LearningSession}[];
  assert.equal(new Set(simultaneous.map((item)=>item.session.id)).size,1,"concurrent starts cannot create extra attempt slots");
  const record=await readRecord("settings");assert.ok(record);
  const results=await Promise.allSettled([writeRecord("settings",record.value,"teacher",record.revision),writeRecord("settings",record.value,"teacher",record.revision)]);
  assert.equal(results.filter((r)=>r.status==="fulfilled").length,1,"only one simultaneous revision can commit");
  await performAction(teacher,{action:"saveDraft",unitId:10,expectedVersion:0,scheduledWeek:10,reviewed:true,published:true,task:TASKS[10]});
  const draft=(await overview(teacher)).configs.find((item)=>item.task.unitId===10)!;
  assert.equal(draft.published,false);assert.equal(draft.reviewedAt,"");assert.equal(draft.reviewedBy,"");
  await assert.rejects(()=>performAction(other,{action:"start",unitId:10,requestId:crypto.randomUUID()}),/尚未发布/);
  await performAction(teacher,{...privacy,retention:"更新后的测试保存安排"});
  await assert.rejects(()=>performAction(other,{action:"answer",sessionId:simultaneous[0].session.id,stage:"initial",text:"旧版本确认不能写入",requestId:crypto.randomUUID()}),/阅读并确认/);
  assert.equal((await loadSession(other,simultaneous[0].session.id)).value.stage,"initial","reading own history remains possible after a notice update");
  await performAction(other,{action:"acknowledgeTeachingNotice",version:2,acknowledged:true});
  assert.equal((await overview(other)).teachingAcknowledgement?.version,2);
  const settings = (await readRecord<any>("settings"))!;
  await writeRecord("settings", { ...settings.value, teachingPrivacy: { ...settings.value.teachingPrivacy, administrationAccessVersion: undefined } }, "teacher", settings.revision);
  await assert.rejects(() => performAction(other, { action: "acknowledgeTeachingNotice", version: 2, acknowledged: true }), /访问范围已变化/);
  await assert.rejects(() => performAction(other, { action: "answer", sessionId: simultaneous[0].session.id, stage: "initial", text: "旧说明不能继续写入", requestId: crypto.randomUUID() }), /最新教学记录访问范围/);
  assert.equal((await loadSession(other, simultaneous[0].session.id)).value.stage, "initial");
  await performAction(teacher, { ...privacy, retention: "更新后的测试保存安排" });
  assert.equal((await overview(other)).settings.teachingPrivacy?.version, 3);
});

test("publishing the Week 10 content revision keeps in-flight answers, chats, task snapshots and timing unchanged", async(t)=>{
  const fake=fakeDatabase(), keys=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","EDU_CLASSROOM_ENABLED","EDU_AI_PROVIDER"];
  const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  t.after(()=>{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}delete (globalThis as any).__CT_AGENT_SUPABASE_SERVER__;});
  process.env.SUPABASE_URL="https://test.invalid";process.env.SUPABASE_SERVICE_ROLE_KEY="test-only";process.env.EDU_CLASSROOM_ENABLED="true";process.env.EDU_AI_PROVIDER="deepseek";
  (globalThis as any).__CT_AGENT_SUPABASE_SERVER__=fake;
  const teacher={userId:"teacher",role:"instructor" as const}, existing={userId:"existing-week10",role:"student" as const}, newcomer={userId:"new-week10",role:"student" as const};
  await performAction(teacher,{action:"teachingPrivacy",notice:"合成课堂说明",contact:"测试教师",retention:"仅测试",reviewed:true});
  for(const a of [existing,newcomer]){await writeRecord(`member:${a.userId}`,{userId:a.userId},a.userId,0);await performAction(a,{action:"acknowledgeTeachingNotice",version:1,acknowledged:true});}
  const legacyTask={...TASKS[10],prompts:{...TASKS[10].prompts,initial:"旧版初答：两种不同的问题表征是什么？",transfer:"旧版迁移：生成并比较至少两个方案。"}};
  const publish={action:"publish",unitId:10,scheduledWeek:10,reviewed:true,published:true};
  await performAction(teacher,{...publish,expectedVersion:0,task:legacyTask});
  const first=(await performAction(existing,{action:"start",unitId:10,requestId:crypto.randomUUID()}) as {session:LearningSession}).session;
  await performAction(existing,{action:"answer",sessionId:first.id,stage:"initial",text:"已提交的旧版回答",requestId:crypto.randomUUID()});
  const record=(await readRecord<LearningSession>(`session:${first.id}`))!;
  await writeRecord(`session:${first.id}`,{...record.value,entries:[...record.value.entries,{id:crypto.randomUUID(),kind:"chat",stage:"revision",text:"已保存问题",reply:"已保存回复",createdAt:now}]},existing.userId,record.revision);
  const before=structuredClone(await readRecord<LearningSession>(`session:${first.id}`));
  const settings=structuredClone(await readRecord("settings"));
  await performAction(teacher,{...publish,expectedVersion:1,task:TASKS[10]});
  assert.deepEqual(await readRecord(`session:${first.id}`),before,"publishing cannot rewrite source bytes, timer, answers or chats");
  assert.deepEqual(await readRecord("settings"),settings,"content publication does not change timing or privacy settings");
  const continued=(await performAction(existing,{action:"start",unitId:10,requestId:crypto.randomUUID()}) as {session:LearningSession}).session;
  assert.equal(continued.id,first.id);assert.equal(continued.task.version,1);assert.deepEqual(continued.task.task,legacyTask);assert.deepEqual(continued.timing,before?.value.timing);
  const next=(await performAction(newcomer,{action:"start",unitId:10,requestId:crypto.randomUUID()}) as {session:LearningSession}).session;
  assert.equal(next.task.version,2);assert.deepEqual(next.task.task,TASKS[10]);assert.deepEqual(next.timing?.suggestedSeconds,DEFAULT_STAGE_SECONDS);
  assert.equal((await overview(newcomer)).attemptLimits.find(x=>x.unitId===10)?.remainingRestarts,1);
  const redo=(await performAction(existing,{action:"restart",sessionId:first.id,confirmed:true,requestId:crypto.randomUUID()}) as {session:LearningSession}).session;
  assert.deepEqual(redo.task.task,legacyTask,"a redo remains comparable with its original task rather than switching questions");
});

test("one redo is append-only, cross-version, concurrent-safe, preserves drafts and keeps legacy work usable", async(t)=>{
  const fake=fakeDatabase(), keys=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","EDU_CLASSROOM_ENABLED","EDU_AI_PROVIDER"];
  const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  t.after(()=>{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}delete (globalThis as any).__CT_AGENT_SUPABASE_SERVER__;});
  process.env.SUPABASE_URL="https://test.invalid";process.env.SUPABASE_SERVICE_ROLE_KEY="test-only";process.env.EDU_CLASSROOM_ENABLED="true";process.env.EDU_AI_PROVIDER="deepseek";
  (globalThis as any).__CT_AGENT_SUPABASE_SERVER__=fake;
  const teacher={userId:"teacher",role:"instructor" as const}, learner={userId:"redo-student",role:"student" as const}, other={userId:"redo-other",role:"student" as const};
  await performAction(teacher,{action:"teachingPrivacy",notice:"测试教学记录与时间说明",contact:"测试教师",retention:"合成测试后清理",reviewed:true});
  for(const a of [learner,other]){await writeRecord(`member:${a.userId}`,{userId:a.userId},a.userId,0);await performAction(a,{action:"acknowledgeTeachingNotice",version:1,acknowledged:true});}
  const publish={action:"publish",unitId:10,expectedVersion:0,scheduledWeek:10,reviewed:true,published:true,task:TASKS[10]};
  await performAction(teacher,publish);
  const begin=()=>performAction(learner,{action:"start",unitId:10,requestId:crypto.randomUUID()}) as Promise<{session:LearningSession}>;
  const first=(await begin()).session;
  await performAction(learner,{action:"answer",sessionId:first.id,stage:"initial",text:"原始回答必须保留",requestId:crypto.randomUUID()});
  const old=(await readRecord<LearningSession>(`session:${first.id}`))!;
  // A saved visible chat fixture avoids real model calls and must survive redo.
  await writeRecord(`session:${first.id}`,{...old.value,entries:[...old.value.entries,{id:crypto.randomUUID(),kind:"chat",stage:"revision",text:"原提问",reply:"原回复",createdAt:now}]},learner.userId,old.revision);
  const before=structuredClone(await readRecord(`session:${first.id}`));
  await performAction(teacher,{...publish,expectedVersion:1,task:{...TASKS[10],title:"老师修改过的新版本"}});
  assert.equal((await begin()).session.id,first.id,"new task version does not replace active work");
  await assert.rejects(()=>performAction(other,{action:"restart",sessionId:first.id,confirmed:true,requestId:crypto.randomUUID()}));
  await assert.rejects(()=>performAction(learner,{action:"restart",sessionId:first.id,requestId:crypto.randomUUID()}),/确认/);
  const redoBody={action:"restart",sessionId:first.id,confirmed:true,answerDraft:"未提交回答",questionDraft:"未发送问题"};
  const concurrent=await Promise.all(Array.from({length:12},()=>performAction(learner,{...redoBody,requestId:crypto.randomUUID()}))) as {session:LearningSession}[];
  assert.equal(new Set(concurrent.map(x=>x.session.id)).size,1,"every concurrent retry shares one insert/quota slot");
  const redo=concurrent[0].session;
  assert.notEqual(redo.id,first.id);assert.equal(redo.attemptNumber,2);assert.equal(redo.task.version,1,"redo pins the original task snapshot");assert.equal(redo.entries.length,0);assert.equal(redo.restartOf,first.id);
  assert.equal(redo.restartSnapshot?.answerDraft,"未提交回答");assert.equal(redo.restartSnapshot?.questionDraft,"未发送问题");
  assert.deepEqual(await readRecord(`session:${first.id}`),before,"restart does not rewrite any source bytes or revision");
  const retired=(await loadSession(learner,first.id)).value;
  assert.equal(retired.supersededBy,redo.id);assert.equal(retired.entries.length,2);assert.equal(retired.savedRestartDraft?.answerDraft,"未提交回答");
  await assert.rejects(()=>performAction(learner,{action:"answer",sessionId:first.id,stage:"revision",text:"旧标签页不能覆盖",requestId:crypto.randomUUID()}),/重做前记录/);
  await assert.rejects(()=>performAction(learner,{action:"chat",sessionId:first.id,text:"旧标签页答疑",requestId:crypto.randomUUID()}),/重做前记录/);
  await assert.rejects(()=>performAction(learner,{...redoBody,sessionId:redo.id,requestId:crypto.randomUUID()}),/重做机会已使用/);
  for(const stage of STAGES)await performAction(learner,{action:"answer",sessionId:redo.id,stage:stage.id,text:`重做${stage.id}`,requestId:crypto.randomUUID()});
  assert.equal((await begin()).session.id,redo.id,"Start/Continue never silently consumes another attempt");
  assert.equal((await overview(learner)).attemptLimits.find(x=>x.unitId===10)?.remainingRestarts,0);
  const stats=await analytics(teacher,false);assert.equal(stats.total,2);assert.ok(stats.rows.some(r=>r.supersededBy===redo.id));
  await assert.rejects(()=>performAction(learner,{action:"timingPolicy",suggestedSeconds:DEFAULT_STAGE_SECONDS}));
  await assert.rejects(()=>performAction(teacher,{action:"timingPolicy",suggestedSeconds:{...DEFAULT_STAGE_SECONDS,initial:1}}));
  await performAction(teacher,{action:"timingPolicy",suggestedSeconds:{...DEFAULT_STAGE_SECONDS,initial:600}});
  assert.equal((await readRecord<LearningSession>(`session:${redo.id}`))?.value.timing?.suggestedSeconds.initial,360,"changing teacher policy never changes in-flight snapshots");
  // Existing >2 attempts are preserved, can continue, but cannot gain a new redo.
  for(let i=0;i<3;i++){const legacy={...fresh(),id:`legacy-${i}`,ownerId:other.userId,unitId:10,task:{...fresh().task,task:TASKS[10]},createdAt:`2026-10-0${i+1}T00:00:00.000Z`};await writeRecord(`session:${legacy.id}`,legacy,other.userId,0);}
  await assert.rejects(()=>performAction(other,{action:"restart",sessionId:"legacy-2",confirmed:true,requestId:crypto.randomUUID()}),/至少两次/);
  const legacyDone=await performAction(other,{action:"answer",sessionId:"legacy-2",stage:"initial",text:"旧作答继续",requestId:crypto.randomUUID()}) as {session:LearningSession};
  assert.equal(legacyDone.session.stage,"revision");assert.equal(legacyDone.session.timing?.stages.initial?.missingStart,true);
  const tie=attemptViews([{...first,id:"z",createdAt:now},{...redo,id:"a",restartOf:"z",createdAt:now}]);assert.equal(tie.find(s=>s.id==="z")?.attemptNumber,1);
});
