import type { TemplateScaffold } from "@/lib/types";

export type TemplateQualityCheck = {
  key: "counterargument" | "bias" | "evidence_standard" | "method_limits" | "transfer_question";
  label: string;
  passed: boolean;
};

function hasPattern(value: string, pattern: RegExp) {
  return pattern.test(value.toLowerCase());
}

export function evaluateTemplateQuality(scaffold: TemplateScaffold): TemplateQualityCheck[] {
  const body = [
    scaffold.taskFrame,
    ...scaffold.reasoningMoves,
    ...scaffold.evidenceRules,
    ...scaffold.outputContract,
  ].join(" ");

  return [
    {
      key: "counterargument",
      label: "Requires counterargument or alternative explanation",
      passed: hasPattern(body, /counter|alternative|oppos|challenge/),
    },
    {
      key: "bias",
      label: "Requires bias/threat identification",
      passed: hasPattern(body, /bias|threat|confound|validity/),
    },
    {
      key: "evidence_standard",
      label: "Defines minimum evidence standard",
      passed: hasPattern(body, /evidence|source|at least|minimum|justif/),
    },
    {
      key: "method_limits",
      label: "Asks for method limits or uncertainty",
      passed: hasPattern(body, /limitation|uncertaint|residual|constraint/),
    },
    {
      key: "transfer_question",
      label: "Prompts transfer/application question",
      passed: hasPattern(body, /apply|transfer|next step|question to ask/),
    },
  ];
}
