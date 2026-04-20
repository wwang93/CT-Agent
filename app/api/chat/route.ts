import { NextResponse } from "next/server";

import { appendEvent } from "@/lib/store";
import { generateCoachReply } from "@/lib/llm";
import {
  authErrorResponse,
  ensureRole,
  requireAuthenticatedUser,
} from "@/lib/auth-server";
import type { ChatMessage } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      courseId?: string;
      weekNumber?: number;
      assignmentId?: string;
      sessionId?: string;
      turnIndex?: number;
      learnerMessage?: string;
      learningObjective?: string;
      culturalContext?: string;
      injectedTemplate?: string;
      injectedTemplateId?: string;
      injectedTemplateVersion?: number;
      conversation?: ChatMessage[];
    };
    const auth = await requireAuthenticatedUser(request);
    ensureRole(auth.role, ["student"]);

    if (
      !body.courseId ||
      typeof body.weekNumber !== "number" ||
      !body.assignmentId ||
      !body.learnerMessage
    ) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const reply = await generateCoachReply({
      learnerMessage: body.learnerMessage,
      learningObjective: body.learningObjective ?? "Improve critical thinking in research methods.",
      culturalContext: body.culturalContext ?? "",
      injectedTemplate: body.injectedTemplate ?? "",
      conversation: body.conversation ?? [],
    });

    await appendEvent({
      type: "chat_turn",
      role: auth.role,
      userId: auth.userId,
      courseId: body.courseId,
      weekNumber: body.weekNumber,
      assignmentId: body.assignmentId,
      ...(body.sessionId ? { sessionId: body.sessionId } : {}),
      ...(typeof body.turnIndex === "number" ? { turnIndex: body.turnIndex } : {}),
      payload: {
        prompt: body.learnerMessage,
        reply,
        objective: body.learningObjective ?? "",
        injectedTemplate: body.injectedTemplate ?? "",
        injectedTemplateId: body.injectedTemplateId ?? "",
        injectedTemplateVersion:
          typeof body.injectedTemplateVersion === "number" ? body.injectedTemplateVersion : null,
      },
    });

    return NextResponse.json({ reply });
  } catch (error) {
    return authErrorResponse(error);
  }
}
