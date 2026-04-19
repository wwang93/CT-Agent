import { NextResponse } from "next/server";

import { generatePromptTemplates } from "@/lib/llm";
import { scaffoldToText } from "@/lib/template-scaffold";
import {
  appendEvent,
  getCourseTemplates,
  saveCourseTemplates,
  setCourseTemplateActiveIndex,
} from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim();
  const weekNumberRaw = url.searchParams.get("weekNumber");
  const assignmentId = url.searchParams.get("assignmentId")?.trim();
  const weekNumber = weekNumberRaw ? Number(weekNumberRaw) : NaN;

  if (!courseId || !assignmentId || !Number.isFinite(weekNumber)) {
    return NextResponse.json(
      { error: "courseId, weekNumber, and assignmentId are required." },
      { status: 400 },
    );
  }

  const record = await getCourseTemplates({
    courseId,
    weekNumber,
    assignmentId,
  });
  if (!record) {
    return NextResponse.json({ record: null });
  }

  return NextResponse.json({
    record,
    activeTemplate: record.templates[record.activeTemplateIndex] ?? "",
    activeScaffold: record.scaffolds?.[record.activeTemplateIndex] ?? null,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      courseId?: string;
      weekNumber?: number;
      assignmentId?: string;
      courseGoal?: string;
      assignmentType?: string;
      culturalContext?: string;
      activeTemplateIndex?: number;
    };

    if (
      !body.userId ||
      !body.courseId ||
      typeof body.weekNumber !== "number" ||
      !body.assignmentId ||
      !body.courseGoal ||
      !body.assignmentType
    ) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const scaffolds = await generatePromptTemplates({
      courseGoal: body.courseGoal,
      assignmentType: body.assignmentType,
      culturalContext: body.culturalContext ?? "",
    });
    const templates = scaffolds.map((item) => scaffoldToText(item));

    const activeTemplateIndex =
      typeof body.activeTemplateIndex === "number" ? body.activeTemplateIndex : 0;

    const record = await saveCourseTemplates({
      courseId: body.courseId,
      weekNumber: body.weekNumber,
      assignmentId: body.assignmentId,
      templates,
      scaffolds,
      activeTemplateIndex,
      courseGoal: body.courseGoal,
      assignmentType: body.assignmentType,
      culturalContext: body.culturalContext ?? "",
      updatedBy: body.userId,
    });

    await appendEvent({
      type: "template_generated",
      role: "instructor",
      userId: body.userId,
      courseId: body.courseId,
      payload: {
        courseGoal: body.courseGoal,
        weekNumber: body.weekNumber,
        assignmentId: body.assignmentId,
        assignmentType: body.assignmentType,
        templateCount: templates.length,
        templates,
        scaffolds,
        activeTemplateIndex: record.activeTemplateIndex,
      },
    });

    return NextResponse.json({
      templates,
      scaffolds,
      record,
      activeTemplate: record.templates[record.activeTemplateIndex] ?? "",
      activeScaffold: record.scaffolds?.[record.activeTemplateIndex] ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Template generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      courseId?: string;
      weekNumber?: number;
      assignmentId?: string;
      userId?: string;
      activeTemplateIndex?: number;
    };

    if (
      !body.courseId ||
      typeof body.weekNumber !== "number" ||
      !body.assignmentId ||
      !body.userId ||
      typeof body.activeTemplateIndex !== "number"
    ) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const record = await setCourseTemplateActiveIndex({
      courseId: body.courseId,
      weekNumber: body.weekNumber,
      assignmentId: body.assignmentId,
      activeTemplateIndex: body.activeTemplateIndex,
      updatedBy: body.userId,
    });

    if (!record) {
      return NextResponse.json(
        { error: "No templates found for this course." },
        { status: 404 },
      );
    }

    await appendEvent({
      type: "template_generated",
      role: "instructor",
      userId: body.userId,
      courseId: body.courseId,
      weekNumber: body.weekNumber,
      assignmentId: body.assignmentId,
      payload: {
        action: "template_selected",
        activeTemplateIndex: record.activeTemplateIndex,
      },
    });

    return NextResponse.json({
      record,
      activeTemplate: record.templates[record.activeTemplateIndex] ?? "",
      activeScaffold: record.scaffolds?.[record.activeTemplateIndex] ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update active template.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
