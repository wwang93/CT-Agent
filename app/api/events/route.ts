import { NextResponse } from "next/server";

import { appendEvent, listEvents } from "@/lib/store";
import { parseRole } from "@/lib/auth";

export async function GET(request: Request) {
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
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: "chat_turn" | "template_generated" | "reflection_saved" | "session_started";
      role?: string;
      userId?: string;
      courseId?: string;
      weekNumber?: number;
      assignmentId?: string;
      sessionId?: string;
      turnIndex?: number;
      payload?: Record<string, unknown>;
    };
    const role = parseRole(body.role ?? "");
    if (
      !body.type ||
      !role ||
      !body.userId ||
      !body.courseId ||
      typeof body.weekNumber !== "number" ||
      !body.assignmentId
    ) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const event = await appendEvent({
      type: body.type,
      role,
      userId: body.userId,
      courseId: body.courseId,
      weekNumber: body.weekNumber,
      assignmentId: body.assignmentId,
      ...(body.sessionId ? { sessionId: body.sessionId } : {}),
      ...(typeof body.turnIndex === "number" ? { turnIndex: body.turnIndex } : {}),
      payload: body.payload,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
