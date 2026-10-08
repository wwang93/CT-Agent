import { NextResponse } from "next/server";
import { getAIStatus } from "@/lib/education/provider";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    authUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    authKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    databaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    aiConfigured: getAIStatus().configured,
    ai: getAIStatus(),
    classroomEnabled: process.env.EDU_CLASSROOM_ENABLED === "true",
  }, { headers: { "Cache-Control": "no-store" } });
}
