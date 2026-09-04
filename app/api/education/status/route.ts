import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    authUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    authKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    databaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
  }, { headers: { "Cache-Control": "no-store" } });
}
