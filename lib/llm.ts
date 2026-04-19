import OpenAI from "openai";

import type { ChatMessage } from "@/lib/types";
import type { TemplateScaffold } from "@/lib/types";
import { normalizeScaffold } from "@/lib/template-scaffold";

function buildFallbackReply(message: string, injectedTemplate?: string): string {
  const claimPrompt = "What is your main claim in one sentence?";
  const evidencePrompt = "What is one specific piece of evidence that supports it?";
  const counterPrompt = "What alternative explanation could challenge your claim?";
  const templateHint = injectedTemplate?.trim()
    ? `Instructor template in effect: ${injectedTemplate.slice(0, 240)}${injectedTemplate.length > 240 ? "..." : ""}`
    : null;

  return [
    "Good start. Let us push your reasoning one step deeper.",
    ...(templateHint ? [templateHint] : []),
    claimPrompt,
    evidencePrompt,
    counterPrompt,
    `You wrote: \"${message.slice(0, 180)}${message.length > 180 ? "..." : ""}\"`,
  ].join("\n");
}

export async function generateCoachReply(input: {
  learnerMessage: string;
  learningObjective: string;
  culturalContext: string;
  injectedTemplate: string;
  conversation: ChatMessage[];
}) {
  if (!process.env.OPENAI_API_KEY) {
    return buildFallbackReply(input.learnerMessage, input.injectedTemplate);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";

  const messages = [
    {
      role: "system" as const,
      content:
        "You are a critical-thinking teaching assistant for higher education. Use a Socratic tone. Do not provide final answers. Ask concise, high-order follow-up questions that require evidence, reasoning, and counterargument. Keep response under 180 words. If an instructor template is supplied, align your questioning with that template while remaining adaptive to the learner's current response.",
    },
    {
      role: "user" as const,
      content: `Learning objective: ${input.learningObjective}\nCultural context: ${input.culturalContext || "Not provided"}\nInstructor template: ${input.injectedTemplate || "None"}\nConversation so far:\n${input.conversation
        .map((item) => `${item.role}: ${item.content}`)
        .join("\n")}\n\nLatest learner message:\n${input.learnerMessage}`,
    },
  ];

  const completion = await client.chat.completions.create({
    model,
    messages,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  return text || buildFallbackReply(input.learnerMessage, input.injectedTemplate);
}

export async function generatePromptTemplates(input: {
  courseGoal: string;
  assignmentType: string;
  culturalContext: string;
}): Promise<TemplateScaffold[]> {
  if (!process.env.OPENAI_API_KEY) {
    return [
      {
        id: "template-a",
        label: "Template A - Evidence Ladder",
        intensity: "light",
        taskFrame: `Complete a ${input.assignmentType} that addresses: ${input.courseGoal}`,
        reasoningMoves: [
          "State one claim and one alternative explanation.",
          "Explain why your preferred explanation is stronger.",
          "Name one assumption that could fail.",
        ],
        evidenceRules: [
          "Use at least two evidence points from course material or data.",
          "Separate observation from interpretation.",
        ],
        outputContract: [
          "Conclude with one limitation and one next-step question.",
          "Keep argument explicit: claim -> evidence -> warrant.",
        ],
        hotDimensions: ["analysis", "evaluation", "inference"],
      },
      {
        id: "template-b",
        label: "Template B - Counterfactual Critique",
        intensity: "medium",
        taskFrame: `Analyze this context: ${input.culturalContext || "local classroom context"}. Produce a critique then rebuild your argument from an opposing stance.`,
        reasoningMoves: [
          "Develop an initial position, then produce a counter-position.",
          "Test where each argument is vulnerable to bias or omitted context.",
          "Justify your final stance with explicit tradeoffs.",
        ],
        evidenceRules: [
          "Cite at least one quantitative and one qualitative evidence source.",
          "Explain why the evidence is credible in this setting.",
        ],
        outputContract: [
          "Include one unresolved uncertainty.",
          "End with two transfer questions you would ask your instructor.",
        ],
        hotDimensions: ["analysis", "evaluation", "metacognition"],
      },
      {
        id: "template-c",
        label: "Template C - Method Audit",
        intensity: "strong",
        taskFrame: "Audit a GenAI-generated answer before you accept or revise it.",
        reasoningMoves: [
          "Identify validity threats and methodological assumptions.",
          "Document how each threat could bias findings.",
          "Propose two concrete mitigations per high-risk threat.",
        ],
        evidenceRules: [
          "Use explicit evidence standards, not general statements.",
          "Link each mitigation to a course concept or method criterion.",
        ],
        outputContract: [
          "Provide an audit table with threat, impact, mitigation, residual risk.",
          "Conclude with a decision: accept, revise, or reject the original answer.",
        ],
        hotDimensions: ["analysis", "evaluation", "inference", "metacognition"],
      },
    ];
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "Generate exactly 3 instructor-ready structured templates for cultivating higher-order thinking with GenAI. Return strict JSON array only. Each item must include: id, label, intensity(light|medium|strong), taskFrame(string), reasoningMoves(string[]), evidenceRules(string[]), outputContract(string[]), hotDimensions(array of analysis|evaluation|inference|metacognition).",
      },
      {
        role: "user",
        content: `Course goal: ${input.courseGoal}\nAssignment type: ${input.assignmentType}\nCultural context: ${input.culturalContext || "Not provided"}`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Expected array");
    }
    const scaffolds = parsed
      .map((item, index) => normalizeScaffold(item, `template-${index + 1}`))
      .filter((item): item is TemplateScaffold => Boolean(item));

    if (scaffolds.length >= 3) {
      return scaffolds.slice(0, 3);
    }
  } catch {
    // fall through to deterministic fallback
  }

  return [
    {
      id: "template-fallback-1",
      label: "Template A - Structured Critique",
      intensity: "medium",
      taskFrame: `Address: ${input.courseGoal}`,
      reasoningMoves: [
        "State claim and alternative explanation.",
        "Explain why one interpretation is stronger.",
      ],
      evidenceRules: ["Use at least two concrete evidence points."],
      outputContract: ["End with one limitation and one instructor question."],
      hotDimensions: ["analysis", "evaluation"],
    },
    {
      id: "template-fallback-2",
      label: "Template B - Evidence and Counterargument",
      intensity: "medium",
      taskFrame: `Use assignment type: ${input.assignmentType}`,
      reasoningMoves: ["Build argument", "Present counterargument", "Revise stance"],
      evidenceRules: ["Cite source quality and relevance."],
      outputContract: ["Document residual uncertainty."],
      hotDimensions: ["evaluation", "inference"],
    },
    {
      id: "template-fallback-3",
      label: "Template C - Metacognitive Audit",
      intensity: "strong",
      taskFrame: "Audit assumptions and method limits before final conclusion.",
      reasoningMoves: ["List assumptions", "Test failure points", "Propose mitigation"],
      evidenceRules: ["Tie each mitigation to evidence."],
      outputContract: ["Conclude with transfer question."],
      hotDimensions: ["analysis", "metacognition"],
    },
  ];
}
