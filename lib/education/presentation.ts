import type { Task } from "./course";

// Only normalize legacy teacher-template vocabulary, never learner-authored records.
export function taskForDisplay(task: Task): Task {
  const text = (value: string) => value.replace(/\s*AI\s*/g, "答疑").replace(/干预一：/g, "活动一：").replace(/干预二：/g, "活动二：");
  return { ...task, title: text(task.title), caseText: text(task.caseText), objective: text(task.objective),
    prompts: Object.fromEntries(Object.entries(task.prompts).map(([key, value]) => [key, text(value)])) as Task["prompts"],
    hints: task.hints.map(text) as Task["hints"], concepts: task.concepts.map(item => ({ term: item.term, text: text(item.text) })), criteria: task.criteria.map(text), source: task.source };
}
