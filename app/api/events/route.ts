import { NextResponse } from "next/server";

import {
  authErrorResponse,
  ensureRole,
  requireAuthenticatedUser,
} from "@/lib/auth-server";
import { appendEvent, listEvents } from "@/lib/store";
import { parseRole } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    ensureRole(auth.role, ["researcher", "instructor"]);

    const url = new URL(request.url);
    const role = parseRole(url.searchParams.get("role"));
    const type = url.searchParams.get("type");
    const courseId = url.searchParams.get("courseId") ?? undefined;
    const assignmentId = url.searchParams.get("assignmentId") ?? undefined;
    const weekRaw = url.searchParams.get("weekNumber");
    const weekNumber = weekRaw ? Number(weekRaw) : undefined;

    const events = await listEvents({
      ...(role ? { role } : {}),
      ...(type ? { type: type as never } : {}),
      ...(courseId ? { courseId } : {}),
      ...(assignmentId ? { assignmentId } : {}),
      ...(typeof weekNumber === "number" && Number.isFinite(weekNumber)
        ? { weekNumber }
        : {}),
    });

    return NextResponse.json({ events });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    const body = (await request.json()) as {
      type?: "chat_turn" | "template_generated" | "reflection_saved" | "session_started";
      courseId?: string;
      weekNumber?: number;
      assignmentId?: string;
      sessionId?: string;
      turnIndex?: number;
      payload?: Record<string, unknown>;
    };

    const role = auth.role;
    if (
      !body.type ||
      !role ||
      !body.courseId ||
      typeof body.weekNumber !== "number" ||
      !body.assignmentId
    ) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    ensureRole(auth.role, ["researcher", "instructor", "student"]);

    const event = await appendEvent({
      type: body.type,
      role,
      userId: auth.userId,
      courseId: body.courseId,
      weekNumber: body.weekNumber,
      assignmentId: body.assignmentId,
      ...(body.sessionId ? { sessionId: body.sessionId } : {}),
      ...(typeof body.turnIndex === "number" ? { turnIndex: body.turnIndex } : {}),
      payload: body.payload,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
