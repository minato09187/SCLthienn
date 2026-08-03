import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Supabase Project Credentials
export const SUPABASE_URL = "https://zfcrfnvfjcuqjjgxbbzn.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_h4Z_yVBEFbneP00PGldvGA_uPt7FdLS";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
