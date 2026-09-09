-- ============================================================================
-- Migration: 025_mobile_variation_photo_DRAFT.sql
-- Status:    DRAFT — NOT APPLIED to any Supabase project as of this commit.
--            Written for review as part of the BIK Field mobile app's
--            Variation Notice photo attachment (mobile/www/variation-
--            notice.html). Do not apply without review — see
--            /mobile-release/RELEASE_CHECKLIST.md's NEEDS KAREN section.
--
-- Purpose:   Lets the mobile app attach one photo (site condition/change)
--            to a variation notice. This is the first use of Supabase
--            Storage anywhere in this codebase — there is no existing
--            bucket or storage.objects RLS policy to extend.
--
-- Design (additive, non-breaking, and deliberately NOT touching
-- create_variation_notice()'s signature at all):
--   1. Two nullable columns on variation_notices (photo_path, photo_
--      content_type) — already covered by the EXISTING blanket
--      `grant select, insert, update on variation_notices to authenticated`
--      and the existing variation_notices_update_same_org RLS policy from
--      010_create_variation_notices.sql. No new grant or policy is needed
--      on the table itself: a new column is automatically included in an
--      existing UPDATE grant/policy that isn't column-restricted.
--   2. A new private Storage bucket, 'variation-notice-photos', with its
--      own RLS policies on storage.objects (Storage's own permission
--      model — separate from table RLS, but reusing the same
--      internal.current_organisation_id() helper every other policy in
--      this codebase already uses).
--   3. Client flow (mobile/www/variation-notice.html): create the
--      variation via the EXISTING create_variation_notice() RPC first
--      (completely unchanged), upload the photo to Storage keyed by the
--      returned variation id, then a plain authenticated UPDATE sets
--      photo_path — the same "Save to project" UPDATE path the desktop
--      tool already uses for every other field, per variation-save-
--      logic.js's buildUpdatePayload(). No RPC signature changes at all.
--
-- Storage path convention enforced by the policies below:
--   {organisation_id}/{variation_notice_id}/{filename}
-- The policies check path segment 1 against the caller's own organisation
-- — the same tenant boundary as every table-level RLS policy in this
-- database, applied to Storage instead.
--
-- Depends on: 010_create_variation_notices.sql, 005_phase1_rls.sql
--             (internal.current_organisation_id())
-- ============================================================================

-- ── 1. New nullable columns ──────────────────────────────────────────────
alter table public.variation_notices
  add column if not exists photo_path         text,
  add column if not exists photo_content_type text;

comment on column public.variation_notices.photo_path is
  'Path of an optional site-condition photo in the variation-notice-photos Storage bucket, as {organisation_id}/{variation_notice_id}/{filename}. Null when no photo was attached (the large majority of existing and desktop-created rows). Set via a plain authenticated UPDATE, same as every other field on this table — no RPC involved.';
comment on column public.variation_notices.photo_content_type is
  'MIME type of the file at photo_path (e.g. image/jpeg), stored alongside it so the web dashboard can render an <img> without guessing from the extension.';

-- ── 2. Storage bucket ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'variation-notice-photos', 'variation-notice-photos', false,
  8388608, -- 8 MB — comfortably above a compressed phone-camera photo (see mobile app's capturePhotoSafe(), quality 70) with headroom, not unlimited
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ── 3. Storage RLS policies (storage.objects) ────────────────────────────
-- Mirrors the org-scoped select/insert/update pattern used by every table
-- policy in this database, applied to storage.objects' own RLS instead —
-- see variation_notices_select_same_org / _insert_same_org /
-- _update_same_org in 010_create_variation_notices.sql for the pattern
-- this follows.

drop policy if exists variation_photos_select_same_org on storage.objects;
create policy variation_photos_select_same_org
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'variation-notice-photos'
    and (storage.foldername(name))[1] = internal.current_organisation_id()::text
  );

drop policy if exists variation_photos_insert_same_org on storage.objects;
create policy variation_photos_insert_same_org
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'variation-notice-photos'
    and (storage.foldername(name))[1] = internal.current_organisation_id()::text
    -- The second path segment must be a variation notice that genuinely
    -- belongs to this organisation — prevents uploading under a
    -- correctly-prefixed org id but an arbitrary/foreign variation id.
    and exists (
      select 1 from public.variation_notices vn
      where vn.id::text = (storage.foldername(name))[2]
        and vn.organisation_id = internal.current_organisation_id()
    )
  );

-- No update/delete policy: a photo is attached once: replacing one means
-- uploading a new object and updating photo_path, not overwriting the old
-- object in place — simpler policy surface, and keeps the previous photo
-- retrievable from Storage until it's genuinely orphaned (acceptable for
-- this MVP; a cleanup job is not part of this migration).

-- ── Reviewer checklist before applying ───────────────────────────────────
-- [ ] Confirm variation_notices has an organisation_id column (used in the
--     insert policy's EXISTS check) — re-verify against the live schema.
-- [ ] Apply to a staging project first if one exists; this repo currently
--     has only one Supabase project (production) — see RELEASE_CHECKLIST.md.
-- [ ] Storage bucket file_size_limit / allowed_mime_types are enforced by
--     Supabase Storage itself at upload time, not by these RLS policies —
--     confirm that behaviour on the actual project version in use.
