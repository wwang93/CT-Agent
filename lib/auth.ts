import type { UserRole } from "@/lib/types";

export const ROLE_QUERY_KEY = "mock_role";
export const ROLE_STORAGE_KEY = "ct-agent-role";

export function parseRole(value: string | null | undefined): UserRole | null {
  if (value === "student" || value === "instructor" || value === "researcher") {
    return value;
  }
  return null;
}

export function getDefaultCourse(role: UserRole): string {
  if (role === "researcher") return "all-courses";
  return "RME-600";
}
