import test from "node:test";
import assert from "node:assert/strict";
import { buildCompletionRequest, getAISelection, getAIStatus, PROVIDER_URLS, requestCompletion } from "../lib/education/provider";
import { coachMessages } from "../lib/education/coach";
import { TASKS } from "../lib/education/course";
import type { LearningSession } from "../lib/education/types";

test("official DeepSeek is default and missing key never selects an available backup",()=>{
  assert.deepEqual(getAISelection({}),{provider:"deepseek",model:"deepseek-flash",thinking:"disabled"});
  assert.equal(PROVIDER_URLS.deepseek,"https://api.deepseek.com");
  assert.equal(getAIStatus({OPENAI_API_KEY:"fake"}).configured,false);
  assert.equal(getAIStatus({DEEPSEEK_API_KEY:"fake"}).configured,true);
  assert.equal(getAIStatus({DEEPSEEK_API_KEY:"  "}).configured,false);
  assert.equal(getAIStatus({EDU_AI_PROVIDER:"unknown"}).configurationError,true);
  assert.equal(getAISelection({EDU_AI_PROVIDER:"openai",EDU_OPENAI_MODEL:"explicit-test-model"}).model,"explicit-test-model");
});
test("completion parameters and credentials are provider-specific",()=>{
  const messages=[{role:"user" as const,content:"问题"}];
  const deepseek=buildCompletionRequest(getAISelection({}),messages);
  assert.equal(deepseek.model,"deepseek-flash");assert.ok("max_tokens" in deepseek);
  assert.deepEqual("thinking" in deepseek && deepseek.thinking,{type:"disabled"});
  assert.ok(!("max_completion_tokens" in deepseek));assert.ok(!("store" in deepseek));
  assert.ok(!("apiKey" in deepseek));
  const openai=buildCompletionRequest(getAISelection({EDU_AI_PROVIDER:"openai"}),messages);
  assert.ok("max_completion_tokens" in openai);assert.ok(!("thinking" in openai));
});
test("coach context excludes future independent prompts and applies basic text minimization",()=>{
  const session:LearningSession={id:"test",ownerId:"test",unitId:10,stage:"revision",language:"英语",entries:[{id:"a",kind:"answer",stage:"initial",text:"我的解释 student@example.com 13812345678",createdAt:"now"}],createdAt:"now",updatedAt:"now",
    task:{task:TASKS[10],version:1,published:true,scheduledWeek:10,interventionId:2,teacherNotes:"",reviewedAt:"now",reviewedBy:"teacher"}};
  const context=JSON.stringify(coachMessages(session,"帮我分析证据"));
  assert.ok(context.includes(TASKS[10].prompts.revision));assert.ok(!context.includes(TASKS[10].prompts.transfer));assert.ok(!context.includes(TASKS[10].prompts.reflection));
  assert.ok(!context.includes("student@example.com"));assert.ok(!context.includes("13812345678"));
  assert.throws(()=>coachMessages({...session,stage:"initial"},"跳过初答"));assert.throws(()=>coachMessages({...session,stage:"transfer"},"帮我作答"));
});
test("SDK sends official request, keeps visible answer only and audits model usage",async(t)=>{
  const original=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY="fake-contract-test-key";
  t.after(()=>{if(original===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=original;});
  let called=0;
  const fakeFetch:typeof fetch=async(url,init)=>{
    called++;assert.equal(String(url),"https://api.deepseek.com/chat/completions");
    const headers=new Headers(init?.headers);assert.equal(headers.get("authorization"),"Bearer fake-contract-test-key");
    const body=JSON.parse(String(init?.body));assert.equal(body.thinking.type,"disabled");assert.equal(body.max_tokens,1200);assert.ok(!body.max_completion_tokens);
    return new Response(JSON.stringify({id:"mock",model:"served-model-test",choices:[{index:0,message:{role:"assistant",content:"请指出支持判断的证据。",reasoning_content:"not-to-persist"},finish_reason:"stop"}],usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}}),{headers:{"Content-Type":"application/json"}});
  };
  const answer=await requestCompletion(getAISelection({}),[{role:"user",content:"问题"}],fakeFetch);
  assert.equal(called,1);assert.equal(answer.provider,"deepseek");assert.equal(answer.servedModel,"served-model-test");assert.equal(answer.tokens,30);assert.equal(answer.inputTokens,20);assert.ok(answer.latencyMs>=0);
  assert.ok(!JSON.stringify(answer).includes("not-to-persist"));assert.ok(!JSON.stringify(answer).includes("fake-contract-test-key"));
  const failedFetch:typeof fetch=async()=>{called++;throw new Error("test failure");};
  await assert.rejects(()=>requestCompletion(getAISelection({}),[],failedFetch));assert.equal(called,2,"no automatic retries");
  delete process.env.DEEPSEEK_API_KEY;await assert.rejects(()=>requestCompletion(getAISelection({}),[],fakeFetch),/尚未启用/);assert.equal(called,2);
});
