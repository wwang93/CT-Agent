import test from "node:test";
import assert from "node:assert/strict";
import { TASKS } from "../lib/education/course";
import { taskForDisplay } from "../lib/education/presentation";
import { TEACHING_NOTICE_DRAFT } from "../lib/education/privacy";

test("course-facing templates use learning vocabulary without rewriting stored records", () => {
  const original = structuredClone(TASKS[6]); original.prompts.initial = "先独立作答，再开放 AI 支持。";
  const displayed = taskForDisplay(original);
  assert.equal(displayed.prompts.initial, "先独立作答，再开放答疑支持。");
  assert.match(original.prompts.initial, /AI/);
  assert.equal(displayed.id, original.id); assert.equal(displayed.unitId, 6);
  for (const unit of [6,10]) assert.doesNotMatch(JSON.stringify(TASKS[unit]), /AI|API|DeepSeek|OpenAI/);
});
test("simpler interface retains truthful assistance, handling and voluntary research notice", () => {
  assert.match(TEACHING_NOTICE_DRAFT, /智能辅助生成/);
  assert.match(TEACHING_NOTICE_DRAFT, /不是教师本人回复/);
  assert.match(TEACHING_NOTICE_DRAFT, /新加坡/);
  assert.match(TEACHING_NOTICE_DRAFT, /单独的自愿选择/);
  assert.match(TEACHING_NOTICE_DRAFT, /包括未同意或已退出研究/);
  assert.match(TEACHING_NOTICE_DRAFT, /查看操作会留痕/);
  assert.doesNotMatch(TEACHING_NOTICE_DRAFT, /API/);
});
