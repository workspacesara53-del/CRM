import { createClient } from "@supabase/supabase-js";
// Lazy initialization to allow environment variables to be loaded first
let _supabaseAdmin = null;
function getSupabaseAdmin() {
    if (_supabaseAdmin)
        return _supabaseAdmin;
    // Support both NEXT_PUBLIC_SUPABASE_URL (Client) and SUPABASE_URL (Worker)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!supabaseUrl) {
        throw new Error("Missing SUPABASE_URL environment variable");
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
    }
    _supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    return _supabaseAdmin;
}
export const supabaseAdmin = new Proxy({}, {
    get(target, prop) {
        return getSupabaseAdmin()[prop];
    }
});
