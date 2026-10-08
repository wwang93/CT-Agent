import "server-only";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { EducationError } from "./engine";
import type { AISelection } from "./types";

type Environment = Record<string, string | undefined>;
export const PROVIDER_URLS = { deepseek: "https://api.deepseek.com", openai: "https://api.openai.com/v1" } as const;
export function getAISelection(env: Environment = process.env): AISelection {
  const provider = env.EDU_AI_PROVIDER?.trim() || "deepseek";
  if (provider !== "deepseek" && provider !== "openai") throw new EducationError("EDU_AI_PROVIDER 必须为 deepseek 或 openai，请联系管理员。", 503);
  return provider === "deepseek"
    ? { provider, model: env.DEEPSEEK_MODEL?.trim() || "deepseek-flash", thinking: "disabled" }
    : { provider, model: env.EDU_OPENAI_MODEL?.trim() || env.EDU_COACH_MODEL?.trim() || env.OPENAI_MODEL?.trim() || "gpt-5-nano", thinking: "provider-default" };
}
export function aiConfigured(selection: AISelection, env: Environment = process.env) {
  return Boolean((selection.provider === "deepseek" ? env.DEEPSEEK_API_KEY : env.OPENAI_API_KEY)?.trim());
}
export function getAIStatus(env: Environment = process.env) {
  try { const selection = getAISelection(env); return { ...selection, configured: aiConfigured(selection, env), configurationError: false }; }
  catch { return { provider: null, model: null, thinking: null, configured: false, configurationError: true }; }
}
export function buildCompletionRequest(selection: AISelection, messages: ChatCompletionMessageParam[]) {
  const common = { model: selection.model, messages, stream: false as const };
  // JavaScript SDK extensions are top-level JSON fields. Keep provider-specific
  // token/storage parameters separate, rather than assuming full API parity.
  return selection.provider === "deepseek"
    ? { ...common, max_tokens: 1200, thinking: { type: "disabled" as const } }
    : { ...common, max_completion_tokens: 1800, store: false };
}
export async function requestCompletion(selection: AISelection, messages: ChatCompletionMessageParam[], fetcher?: typeof fetch) {
  if (!aiConfigured(selection)) throw new EducationError(`${selection.provider === "deepseek" ? "DeepSeek 官方" : "OpenAI"}答疑尚未启用，请使用教师分层提示。`, 503);
  const key = selection.provider === "deepseek" ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY;
  const client = new OpenAI({ apiKey: key, baseURL: PROVIDER_URLS[selection.provider], timeout: 30_000, maxRetries: 0, ...(fetcher ? { fetch: fetcher } : {}) });
  const started = Date.now();
  const request: ChatCompletionCreateParamsNonStreaming = buildCompletionRequest(selection, messages);
  const completion = await client.chat.completions.create(request);
  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply || completion.choices[0]?.finish_reason === "length") throw new EducationError("模型未返回完整可用内容，请使用分层提示或稍后重试。", 502);
  // Only persist the visible reply, never reasoning_content or credentials.
  return { reply, provider: selection.provider, model: selection.model, servedModel: completion.model, thinking: selection.thinking,
    tokens: completion.usage?.total_tokens ?? 0, inputTokens: completion.usage?.prompt_tokens ?? 0, outputTokens: completion.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - started };
}
