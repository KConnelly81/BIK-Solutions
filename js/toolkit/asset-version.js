/**
 * Single source of truth for the cache-busting `?v=` token appended to
 * every tool's import of the shared startup modules
 * (supabase-project-context.js, supabase-record-panel.js). Static ES
 * `import` specifiers must be string literals — they can't reference this
 * constant directly — so this file is the value to copy from, and the
 * thing to grep for, whenever either shared file changes and every
 * importer's literal `?v=` needs bumping together:
 *
 *   grep -rn "supabase-project-context.js?v=\|supabase-record-panel.js?v=" \
 *     --include="*.js" --include="*.html" .
 *
 * Importers, as of this token: js/tools/variation-notice/
 * supabase-integration.js, js/tools/quote-builder/supabase-integration.js,
 * js/tools/progress-claim/supabase-integration.js,
 * js/toolkit/supabase-document-integration.js (covers all 17
 * project_documents tools), attendance.html, project-hub.html.
 */
export const ASSET_VERSION = '20260804a';
