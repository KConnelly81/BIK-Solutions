/**
 * Single shared Supabase client for the entire app. Every page that talks
 * to Supabase imports `supabase` from here rather than calling
 * createClient() itself, so there is exactly one client (and one auth
 * session) per tab.
 *
 * Browser-safe values only: the project URL and the publishable
 * ("anon"/publishable) key. Both are meant to be public — RLS on the
 * database (supabase/migrations/005_phase1_rls.sql) is the actual
 * security boundary, not secrecy of this key. The service_role key must
 * never appear in any file under js/ — it is a server/admin credential.
 *
 * Depends on js/vendor/supabase-js.min.js having already been loaded via
 * a plain <script> tag (not type="module") earlier in the page, which
 * defines the global `supabase` UMD namespace this module reads
 * `createClient` from.
 */

const SUPABASE_URL = 'https://hpcqncghvdrlvufxfdnd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZdikW-1DVorkeJgFeZ5Dhw_KNkxBTkk';

const { createClient } = window.supabase;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
