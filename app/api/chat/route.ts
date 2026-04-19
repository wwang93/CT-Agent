import { NextResponse } from "next/server";

import { appendEvent } from "@/lib/store";
import { generateCoachReply } from "@/lib/llm";
import { parseRole } from "@/lib/auth";
import type { ChatMessage } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      role?: string;
      userId?: string;
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

    const role = parseRole(body.role ?? "");
    if (
      !role ||
      !body.userId ||
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
      role,
      userId: body.userId,
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
    const message = error instanceof Error ? error.message : "Failed to generate reply.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
