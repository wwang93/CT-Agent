import type { TemplateScaffold } from "@/lib/types";

export function scaffoldToText(scaffold: TemplateScaffold): string {
  const moves = scaffold.reasoningMoves.map((item) => `- ${item}`).join("\n");
  const evidence = scaffold.evidenceRules.map((item) => `- ${item}`).join("\n");
  const output = scaffold.outputContract.map((item) => `- ${item}`).join("\n");

  return [
    `${scaffold.label} (${scaffold.intensity.toUpperCase()} guidance)`,
    `Task frame: ${scaffold.taskFrame}`,
    "Reasoning moves:",
    moves,
    "Evidence rules:",
    evidence,
    "Output contract:",
    output,
    `HOT dimensions: ${scaffold.hotDimensions.join(", ")}`,
  ].join("\n");
}

export function normalizeScaffold(raw: unknown, fallbackId: string): TemplateScaffold | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  const hot = Array.isArray(item.hotDimensions)
    ? item.hotDimensions.filter((value) =>
        ["analysis", "evaluation", "inference", "metacognition"].includes(String(value)),
      )
    : [];

  const intensity =
    item.intensity === "light" || item.intensity === "medium" || item.intensity === "strong"
      ? item.intensity
      : "medium";

  const toList = (value: unknown) =>
    Array.isArray(value)
      ? value.map((entry) => String(entry).trim()).filter(Boolean)
      : [];

  const scaffold: TemplateScaffold = {
    id: String(item.id ?? fallbackId),
    label: String(item.label ?? "Template"),
    intensity,
    taskFrame: String(item.taskFrame ?? "").trim(),
    reasoningMoves: toList(item.reasoningMoves),
    evidenceRules: toList(item.evidenceRules),
    outputContract: toList(item.outputContract),
    hotDimensions: hot as TemplateScaffold["hotDimensions"],
  };

  if (
    !scaffold.taskFrame ||
    scaffold.reasoningMoves.length === 0 ||
    scaffold.evidenceRules.length === 0 ||
    scaffold.outputContract.length === 0
  ) {
    return null;
  }

  if (scaffold.hotDimensions.length === 0) {
    scaffold.hotDimensions = ["analysis", "evaluation"];
  }

  return scaffold;
}
