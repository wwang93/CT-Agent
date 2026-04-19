export type UserRole = "student" | "instructor" | "researcher";

export type GuidanceIntensity = "light" | "medium" | "strong";

export type TemplateScaffold = {
  id: string;
  label: string;
  intensity: GuidanceIntensity;
  taskFrame: string;
  reasoningMoves: string[];
  evidenceRules: string[];
  outputContract: string[];
  hotDimensions: Array<"analysis" | "evaluation" | "inference" | "metacognition">;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type EventRecord = {
  id: string;
  type:
    | "chat_turn"
    | "template_generated"
    | "reflection_saved"
    | "session_started";
  role: UserRole;
  userId: string;
  courseId: string;
  weekNumber?: number;
  assignmentId?: string;
  sessionId?: string;
  turnIndex?: number;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type CourseTemplateRecord = {
  courseId: string;
  weekNumber: number;
  assignmentId: string;
  templates: string[];
  scaffolds?: TemplateScaffold[];
  activeTemplateIndex: number;
  templateVersion: number;
  courseGoal: string;
  assignmentType: string;
  culturalContext: string;
  updatedAt: string;
  updatedBy: string;
};

export type AnalyticsSummary = {
  totalChatTurns: number;
  uniqueLearners: number;
  avgPromptLength: number;
  evidenceUseRate: number;
  counterargumentRate: number;
  highOrderSignalRate: number;
  engagementProfiles: Array<{
    bucket: "high" | "moderate" | "low";
    users: number;
  }>;
  weeklyTurnCounts: Array<{
    weekNumber: number;
    chatTurns: number;
    uniqueLearners: number;
  }>;
};
