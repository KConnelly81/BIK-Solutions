-- ============================================================================
-- Migration: 021_set_function_search_paths.sql
-- Purpose:   Six functions never had an explicit `search_path` set, unlike
--            every other function in this schema (which consistently use
--            `set search_path = ''`, fully qualifying every reference —
--            see 005/006/007/018's own functions for the established
--            pattern). Flagged by Supabase's advisor lints
--            (function_search_path_mutable) and a platform health check.
--
--            Without a fixed search_path, a SECURITY DEFINER (or, for
--            trigger functions, definer-context-adjacent) function resolves
--            unqualified identifiers against whatever search_path is in
--            effect for the calling session, which — in the standard
--            Postgres/Supabase privilege model — a sufficiently privileged
--            caller could influence (e.g. via a same-named object placed
--            earlier in a role's search_path). Every one of these six
--            functions already fully qualifies its own object references
--            (`public.profiles`, `internal.is_owner()`, etc.), so this
--            migration changes no behaviour — it only removes the
--            session-supplied search_path as a variable the function's
--            name resolution could ever depend on, closing the class of
--            bug even though nothing here currently exploits it.
--
--            Uses ALTER FUNCTION rather than CREATE OR REPLACE FUNCTION:
--            all six are niladic (take no arguments), so the signature is
--            unambiguous, and ALTER FUNCTION changes only the search_path
--            configuration parameter — it cannot alter the function body,
--            so there is no risk of this migration accidentally changing
--            behaviour by restating logic incorrectly.
--
-- Phase:     Hardening follow-up (platform health check, Part C)
-- Depends on: 001_create_organisations.sql (set_updated_at),
--             005_phase1_rls.sql (internal.is_owner, internal.is_admin,
--               prevent_unauthorised_profile_role_change),
--             010_create_variation_notices.sql
--               (capture_variation_notice_issued_snapshot),
--             011_variation_notice_number_generator.sql
--               (internal.prevent_variation_number_counter_decrease)
-- ============================================================================

alter function public.prevent_unauthorised_profile_role_change() set search_path = '';
alter function public.capture_variation_notice_issued_snapshot() set search_path = '';
alter function public.set_updated_at() set search_path = '';
alter function internal.is_owner() set search_path = '';
alter function internal.is_admin() set search_path = '';
alter function internal.prevent_variation_number_counter_decrease() set search_path = '';
