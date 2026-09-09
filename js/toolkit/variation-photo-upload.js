/**
 * Variation Notice — photo attachment upload (BIK Field mobile app only).
 *
 * Uploads to the 'variation-notice-photos' Storage bucket added by
 * supabase/migrations/025_mobile_variation_photo_DRAFT.sql (not yet
 * applied — see that file). Deliberately does not touch
 * create_variation_notice() or variation-save-logic.js: the variation is
 * created first via the existing, unchanged RPC; this function only
 * uploads a file and then does a plain authenticated UPDATE of
 * photo_path/photo_content_type — the same "Save to project" UPDATE path
 * variation-save-logic.js's buildUpdatePayload() already uses for every
 * other field, per that migration's design notes.
 *
 * No desktop page imports this — mobile/www/variation-notice.html only.
 */

import { supabase } from '../supabase/client.js';

const BUCKET = 'variation-notice-photos';

/**
 * @param {Object} opts
 * @param {string} opts.organisationId
 * @param {string} opts.variationNoticeId
 * @param {string} opts.base64 — raw base64 (no data: prefix)
 * @param {string} opts.format — 'jpeg' | 'png' | 'webp'
 * @returns {Promise<{ error: string|null }>} — never throws; a storage or
 *   RLS failure surfaces as a friendly string the caller can show inline,
 *   consistent with every other Supabase call in this codebase.
 */
export async function uploadVariationPhoto({ organisationId, variationNoticeId, base64, format }) {
  const ext = format === 'jpeg' ? 'jpg' : format;
  const contentType = `image/${format === 'jpg' ? 'jpeg' : format}`;
  const path = `${organisationId}/${variationNoticeId}/photo-${Date.now()}.${ext}`;

  try {
    const bytes = base64ToUint8Array(base64);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (uploadError) {
      return { error: friendlyUploadError(uploadError) };
    }

    const { error: updateError } = await supabase
      .from('variation_notices')
      .update({ photo_path: path, photo_content_type: contentType })
      .eq('id', variationNoticeId);
    if (updateError) {
      return { error: 'Photo uploaded, but could not be attached to the variation. Please try again.' };
    }

    return { error: null };
  } catch (err) {
    return { error: 'Could not upload the photo. Check your connection and try again.' };
  }
}

/** Signed URL for displaying an attached photo (bucket is private). */
export async function getVariationPhotoUrl(photoPath, expiresInSeconds = 3600) {
  if (!photoPath) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(photoPath, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl || null;
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function friendlyUploadError(error) {
  const message = error?.message || String(error || '');
  if (/exceeded the maximum allowed size/i.test(message)) {
    return 'This photo is too large. Please try a different photo.';
  }
  if (/mime type|not supported/i.test(message)) {
    return 'This photo format isn’t supported. Please use a standard photo.';
  }
  return 'Could not upload the photo. Please try again.';
}
