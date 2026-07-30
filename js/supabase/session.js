/**
 * Shared session/auth helpers used by signup.html, signin.html, and
 * app-dashboard.html. Centralises: session checks, protected-page
 * gating, the "does this authenticated user have a profile yet" lookup,
 * sign-out, and friendly error text — so each page's own script stays
 * focused on its form, not on re-deriving auth plumbing.
 */

import { supabase } from './client.js';

/**
 * sessionStorage key for the non-sensitive organisation-setup details a
 * user enters at signup. Only ever holds { organisationName, fullName,
 * abn } — never a password or token. Used to pre-fill the bootstrap step
 * if the same tab is still open after email confirmation; deliberately
 * not relied upon as the only path, since a confirmation link often
 * opens in a new tab/device where sessionStorage does not carry over.
 */
export const PENDING_ORG_SETUP_KEY = 'bik_pending_org_setup';

export function savePendingOrgSetup(details) {
  try {
    sessionStorage.setItem(PENDING_ORG_SETUP_KEY, JSON.stringify(details));
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — non-fatal,
    // the user can just re-enter these details at the bootstrap step.
  }
}

export function readPendingOrgSetup() {
  try {
    const raw = sessionStorage.getItem(PENDING_ORG_SETUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingOrgSetup() {
  try {
    sessionStorage.removeItem(PENDING_ORG_SETUP_KEY);
  } catch {
    // ignore
  }
}

/** Returns the current session, or null if signed out. */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

/**
 * Gate for protected pages. Resolves to the session if one exists;
 * otherwise redirects to signInUrl and resolves to null. Callers must
 * keep their protected content hidden (e.g. a [hidden] attribute in the
 * HTML itself, not toggled late by script) until this resolves, so
 * nothing protected paints before the check completes.
 */
export async function requireSession(signInUrl = 'signin.html') {
  const session = await getSession();
  if (!session) {
    window.location.replace(signInUrl);
    return null;
  }
  return session;
}

/**
 * For signup.html/signin.html: if the visitor is already authenticated,
 * send them straight to the dashboard instead of showing the form again
 * (avoids a confused re-signup attempt, which would just hit "a profile
 * already exists" or a duplicate-account error).
 */
export async function redirectIfSignedIn(dashboardUrl = 'app-dashboard.html') {
  const session = await getSession();
  if (session) {
    window.location.replace(dashboardUrl);
    return true;
  }
  return false;
}

/**
 * Loads the current user's profile together with their organisation in
 * one request (PostgREST embedded resource, following the profiles ->
 * organisations foreign key). Returns null if the user is authenticated
 * but has no profile row yet (fresh signup that hasn't bootstrapped, or
 * hasn't finished bootstrapping) — RLS returns zero rows in that case,
 * not an error, so this is a normal, expected outcome to handle, not a
 * failure.
 */
export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, status, organisation_id, organisations ( id, name, status )')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function signOut(signInUrl = 'signin.html') {
  await supabase.auth.signOut();
  window.location.replace(signInUrl);
}

/**
 * Turns a Supabase Auth/PostgREST/RPC error into user-facing text.
 * Most backend errors (e.g. bootstrap_organisation()'s validation
 * messages) are already written to be shown directly — see
 * supabase/migrations/006_create_organisation_bootstrap.sql — so this
 * mostly passes error.message through, with a couple of common auth
 * cases reworded for clarity.
 */
export function friendlyAuthError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  const message = error.message || String(error);

  if (/Invalid login credentials/i.test(message)) {
    return 'That email or password is not correct.';
  }
  if (/Email not confirmed/i.test(message)) {
    return 'Please confirm your email address before signing in — check your inbox for the confirmation link.';
  }
  if (/User already registered/i.test(message)) {
    return 'An account already exists for that email. Try signing in instead.';
  }
  if (/A profile already exists for this account/i.test(message)) {
    return 'Your organisation is already set up.';
  }
  return message;
}
