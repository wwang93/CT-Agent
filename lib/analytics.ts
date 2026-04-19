import type { AnalyticsSummary, EventRecord } from "@/lib/types";

const EVIDENCE_PATTERN = /because|evidence|data|source|according to|study/i;
const COUNTER_PATTERN = /however|counter|alternative|on the other hand|although/i;
const HIGH_ORDER_PATTERN = /analyz|evaluate|infer|justify|critique|synthesize|compare/i;

export function summarizeEvents(events: EventRecord[]): AnalyticsSummary {
  const chatTurns = events.filter((event) => event.type === "chat_turn");
  const learners = new Set(chatTurns.map((event) => event.userId));

  let totalPromptLength = 0;
  let evidenceCount = 0;
  let counterCount = 0;
  let highOrderCount = 0;

  const turnCountByUser = new Map<string, number>();
  const weeklyMap = new Map<number, { turns: number; learners: Set<string> }>();

  for (const event of chatTurns) {
    const prompt = String(event.payload.prompt ?? "");
    totalPromptLength += prompt.length;

    if (EVIDENCE_PATTERN.test(prompt)) evidenceCount += 1;
    if (COUNTER_PATTERN.test(prompt)) counterCount += 1;
    if (HIGH_ORDER_PATTERN.test(prompt)) highOrderCount += 1;

    turnCountByUser.set(event.userId, (turnCountByUser.get(event.userId) ?? 0) + 1);

    const weekNumber = event.weekNumber ?? 0;
    const weekly = weeklyMap.get(weekNumber) ?? { turns: 0, learners: new Set<string>() };
    weekly.turns += 1;
    weekly.learners.add(event.userId);
    weeklyMap.set(weekNumber, weekly);
  }

  const totalTurns = chatTurns.length;

  let high = 0;
  let moderate = 0;
  let low = 0;

  for (const turns of turnCountByUser.values()) {
    if (turns >= 12) high += 1;
    else if (turns >= 6) moderate += 1;
    else low += 1;
  }

  return {
    totalChatTurns: totalTurns,
    uniqueLearners: learners.size,
    avgPromptLength: totalTurns > 0 ? Number((totalPromptLength / totalTurns).toFixed(1)) : 0,
    evidenceUseRate: totalTurns > 0 ? Number(((evidenceCount / totalTurns) * 100).toFixed(1)) : 0,
    counterargumentRate: totalTurns > 0 ? Number(((counterCount / totalTurns) * 100).toFixed(1)) : 0,
    highOrderSignalRate: totalTurns > 0 ? Number(((highOrderCount / totalTurns) * 100).toFixed(1)) : 0,
    engagementProfiles: [
      { bucket: "high", users: high },
      { bucket: "moderate", users: moderate },
      { bucket: "low", users: low },
    ],
    weeklyTurnCounts: [...weeklyMap.entries()]
      .map(([weekNumber, value]) => ({
        weekNumber,
        chatTurns: value.turns,
        uniqueLearners: value.learners.size,
      }))
      .sort((a, b) => a.weekNumber - b.weekNumber),
  };
}
