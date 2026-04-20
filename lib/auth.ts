import type { UserRole } from "@/lib/types";

export function parseRole(value: string | null | undefined): UserRole | null {
  if (value === "student" || value === "instructor" || value === "researcher") {
    return value;
  }
  return null;
}

export function roleLandingPath(role: UserRole) {
  if (role === "student") return "/student";
  if (role === "instructor") return "/instructor";
  return "/research";
}

export function getDefaultCourse(role: UserRole): string {
  if (role === "researcher") return "all-courses";
  return "RME-600";
}
