import crypto from "node:crypto";
import { COURSE } from "./course";
import { EducationError } from "./engine";

export function normalizeLearningId(value: unknown): string {
  if (typeof value !== "string") throw new EducationError("请输入教师发放的学习 ID。", 400);
  const id = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9-]{2,23}$/.test(id)) throw new EducationError("学习 ID 须为 3—24 位字母、数字或短横线，以字母开头。", 400);
  return id;
}

// A non-deliverable internal Auth alias, not a student's mailbox or identity.
// Password hashing, tokens, refresh and session persistence remain Supabase's job.
export function learningAuthEmail(id: string): string {
  const hash = crypto.createHash("sha256").update(`${COURSE.id}:${normalizeLearningId(id)}`).digest("hex");
  return `learner-${hash}@students.ct-agent.invalid`;
}

export function generateAccessCode(): string {
  return `C${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

export function validateAccessCode(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{11,127}$/.test(value) || !/[A-Za-z]/.test(value) || /^(.)\1+$/.test(value)) {
    throw new EducationError("访问码须为 12—128 位，含字母，以字母或数字开头，仅使用字母、数字、短横线或下划线，不能全部是同一个字符。", 400);
  }
  return value;
}

export type LearningAccount = {
  learnerId: string;
  role?: "student" | "instructor";
  userId?: string;
  status: "provisioning" | "active" | "resetting";
  credentialVersion: string;
  createdBy: string;
  createdAt: string;
  resetAt?: string;
};
export type IssuedLearningCode = { learnerId: string; accessCode: string };
