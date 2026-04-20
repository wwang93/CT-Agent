import { NextResponse } from "next/server";

import {
  authErrorResponse,
  ensureRole,
  requireAuthenticatedUser,
} from "@/lib/auth-server";
import { listEvents } from "@/lib/store";
import { summarizeEvents } from "@/lib/analytics";

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    ensureRole(auth.role, ["researcher", "instructor"]);

    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId") ?? undefined;
    const assignmentId = url.searchParams.get("assignmentId") ?? undefined;
    const weekRaw = url.searchParams.get("weekNumber");
    const weekNumber = weekRaw ? Number(weekRaw) : undefined;

    const events = await listEvents({
      ...(courseId ? { courseId } : {}),
      ...(assignmentId ? { assignmentId } : {}),
      ...(typeof weekNumber === "number" && Number.isFinite(weekNumber)
        ? { weekNumber }
        : {}),
    });
    const summary = summarizeEvents(events);

    return NextResponse.json({ summary, sampleSize: events.length });
  } catch (error) {
    return authErrorResponse(error);
  }
}
