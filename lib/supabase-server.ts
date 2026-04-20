import { createClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __CT_AGENT_SUPABASE_SERVER__: ReturnType<typeof createClient> | undefined;
}

export function getSupabaseAdminClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!globalThis.__CT_AGENT_SUPABASE_SERVER__) {
    globalThis.__CT_AGENT_SUPABASE_SERVER__ = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return globalThis.__CT_AGENT_SUPABASE_SERVER__;
}
