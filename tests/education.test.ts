import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { ACTIVE_UNIT_IDS, COURSE, INTERVENTIONS, STAGES, TASKS, UNITS } from "../lib/education/course";
import { actionId, applyAnswer, applyHint, assertOwner, assertUnlocked, redactText, sessionSummary, unitId, validateTask } from "../lib/education/engine";
import type { LearningSession } from "../lib/education/types";
import { analytics, loadSession, overview, performAction } from "../lib/education/service";
import { readRecord, writeRecord } from "../lib/education/store";
import { requireAuthenticatedUser } from "../lib/auth-server";

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
  const keys=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","EDU_CLASSROOM_ENABLED","DEEPSEEK_API_KEY","OPENAI_API_KEY","EDU_AI_PROVIDER","DEEPSEEK_MODEL"];
  const originalEnv=Object.fromEntries(keys.map((key)=>[key,process.env[key]]));
  t.after(()=>{globalThis.fetch=originalFetch;for(const key of keys) {if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];} delete (globalThis as any).__CT_AGENT_SUPABASE_SERVER__;});
  process.env.SUPABASE_URL="https://test.invalid";process.env.SUPABASE_SERVICE_ROLE_KEY="test-only";process.env.EDU_CLASSROOM_ENABLED="true";
  process.env.EDU_AI_PROVIDER="deepseek";delete process.env.DEEPSEEK_API_KEY;delete process.env.OPENAI_API_KEY;delete process.env.DEEPSEEK_MODEL;
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
  const simultaneous=await Promise.all(Array.from({length:10},()=>performAction(other,{action:"start",unitId:6,requestId:crypto.randomUUID(),language:"英语"}))) as {session:LearningSession}[];
  assert.equal(new Set(simultaneous.map((item)=>item.session.id)).size,1,"concurrent starts cannot create extra attempt slots");
  const record=await readRecord("settings");assert.ok(record);
  const results=await Promise.allSettled([writeRecord("settings",record.value,"teacher",record.revision),writeRecord("settings",record.value,"teacher",record.revision)]);
  assert.equal(results.filter((r)=>r.status==="fulfilled").length,1,"only one simultaneous revision can commit");
});
