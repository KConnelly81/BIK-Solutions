/**
 * BIK Xero Proxy — Cloudflare Worker
 *
 * Handles the OAuth2 "Authorization Code" connection flow to Xero on behalf
 * of a BIK organisation, and stores the resulting tokens in
 * public.accounting_connections (service-role only — see
 * supabase/migrations/025_create_accounting_connections.sql).
 *
 * Client ID/secret and the Supabase service role key are Worker secrets
 * (never in source) — see ALL REQUIRED SECRETS below.
 *
 * Deploy:
 *   cd cloudflare-worker-xero
 *   wrangler deploy
 *
 * Set secrets (once each, stored encrypted by Cloudflare):
 *   wrangler secret put XERO_CLIENT_ID
 *   wrangler secret put XERO_CLIENT_SECRET
 *   wrangler secret put XERO_STATE_SECRET        (any long random string — see buildState())
 *   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
 *
 * Non-secret vars (wrangler.toml [vars]): SUPABASE_URL, ALLOWED_ORIGIN,
 * APP_REDIRECT_URL, WORKER_BASE_URL.
 *
 * ── Register this exact redirect URI in the Xero app's settings ──────────
 *   <WORKER_BASE_URL>/callback
 * e.g. https://bik-xero-proxy.biksolutions.workers.dev/callback
 * Must match byte-for-byte (including trailing slash absence) or Xero
 * rejects the token exchange.
 *
 * Scopes requested: openid profile email accounting.transactions
 * accounting.contacts offline_access — the minimum needed to identify the
 * connecting user, read/write transactions and contacts, and receive a
 * refresh token. Widen only when a specific feature needs more (e.g.
 * accounting.settings for tax rates/tracking categories).
 *
 * Known simplification (documented, not an oversight): a Xero organisation
 * can expose multiple tenants in one consent grant (e.g. an accountant with
 * several clients). This Worker stores only the first tenant returned by
 * GET /connections. Multi-tenant selection is future work once BIK
 * actually needs it — most BIK customers (a single trade business) will
 * only ever see one tenant here.
 */

const XERO_AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL     = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';
const XERO_SCOPES = 'openid profile email accounting.transactions accounting.contacts offline_access';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin':  env.ALLOWED_ORIGIN || 'https://biksolutions.com.au',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// ── State param: carries organisation_id through the Xero redirect
// round-trip, HMAC-signed so a forged org id can't be submitted to
// /callback directly. Not a general-purpose session token — single use,
// short-lived in practice (a few minutes, the time a user takes to approve
// the Xero consent screen). No server-side replay tracking in this first
// version (documented simplification, not an oversight): the worst case
// of reusing an intercepted state value is re-pointing a connection that
// requires completing Xero's own OAuth consent screen with real Xero
// credentials, not a silent takeover. ────────────────────────────────────
async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildState(orgId, userId, env) {
  const nonce = crypto.randomUUID();
  const payload = `${orgId}:${userId}:${nonce}`;
  const sig = await hmac(env.XERO_STATE_SECRET, payload);
  return `${payload}:${sig}`;
}

async function verifyState(state, env) {
  const parts = (state || '').split(':');
  if (parts.length !== 4) return null;
  const [orgId, userId, nonce, sig] = parts;
  const expected = await hmac(env.XERO_STATE_SECRET, `${orgId}:${userId}:${nonce}`);
  if (expected !== sig) return null;
  return { orgId, userId };
}

// ── Resolves the Supabase-authenticated caller to their user id and
// organisation_id. Never trusts a client-supplied org id —
// profiles.organisation_id (one organisation per user, see
// 002_create_profiles.sql) is the sole source.
async function resolveCaller(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_PUBLISHABLE_KEY },
  });
  if (!userResp.ok) return null;
  const user = await userResp.json();
  if (!user?.id) return null;

  const profileResp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=organisation_id`,
    {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );
  if (!profileResp.ok) return null;
  const rows = await profileResp.json();
  const orgId = rows?.[0]?.organisation_id;
  if (!orgId) return null;
  return { userId: user.id, orgId };
}

async function upsertConnection(orgId, tokens, tenant, userId, env) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/accounting_connections?on_conflict=organisation_id,provider`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        organisation_id: orgId,
        provider: 'xero',
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName || '',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || 'Bearer',
        expires_at: expiresAt,
        scope: tokens.scope || '',
        connected_by: userId,
      }),
    }
  );
  return resp.ok;
}

async function handleConnect(request, env) {
  const caller = await resolveCaller(request, env);
  if (!caller) return json({ error: 'Not authenticated.' }, 401, corsHeaders(env));

  const state = await buildState(caller.orgId, caller.userId, env);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.XERO_CLIENT_ID,
    redirect_uri: `${env.WORKER_BASE_URL}/callback`,
    scope: XERO_SCOPES,
    state,
  });
  return json({ authorizeUrl: `${XERO_AUTHORIZE_URL}?${params}` }, 200, corsHeaders(env));
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const redirectTo = (status, reason) => {
    const dest = new URL(env.APP_REDIRECT_URL);
    dest.searchParams.set('xero', status);
    if (reason) dest.searchParams.set('reason', reason);
    return Response.redirect(dest.toString(), 302);
  };

  if (errorParam) return redirectTo('error', errorParam);
  if (!code || !state) return redirectTo('error', 'missing_code_or_state');

  const verified = await verifyState(state, env);
  if (!verified) return redirectTo('error', 'invalid_state');
  const { orgId, userId } = verified;

  let tokenResp;
  try {
    tokenResp = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${env.XERO_CLIENT_ID}:${env.XERO_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${env.WORKER_BASE_URL}/callback`,
      }),
    });
  } catch {
    return redirectTo('error', 'token_exchange_network_error');
  }
  if (!tokenResp.ok) return redirectTo('error', 'token_exchange_failed');
  const tokens = await tokenResp.json();

  let connectionsResp;
  try {
    connectionsResp = await fetch(XERO_CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
  } catch {
    return redirectTo('error', 'connections_lookup_network_error');
  }
  if (!connectionsResp.ok) return redirectTo('error', 'connections_lookup_failed');
  const connections = await connectionsResp.json();
  const tenant = connections?.[0];
  if (!tenant) return redirectTo('error', 'no_tenant_authorized');

  const saved = await upsertConnection(orgId, tokens, tenant, userId, env);
  if (!saved) return redirectTo('error', 'save_failed');

  return redirectTo('connected');
}

async function handleStatus(request, env) {
  const caller = await resolveCaller(request, env);
  if (!caller) return json({ error: 'Not authenticated.' }, 401, corsHeaders(env));

  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/accounting_connections?organisation_id=eq.${caller.orgId}&provider=eq.xero&select=tenant_name,created_at,updated_at`,
    {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );
  if (!resp.ok) return json({ connected: false }, 200, corsHeaders(env));
  const rows = await resp.json();
  const row = rows?.[0];
  if (!row) return json({ connected: false }, 200, corsHeaders(env));

  return json(
    { connected: true, tenantName: row.tenant_name, connectedAt: row.created_at },
    200,
    corsHeaders(env)
  );
}

async function handleDisconnect(request, env) {
  const caller = await resolveCaller(request, env);
  if (!caller) return json({ error: 'Not authenticated.' }, 401, corsHeaders(env));

  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/accounting_connections?organisation_id=eq.${caller.orgId}&provider=eq.xero`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );
  return json({ disconnected: resp.ok }, resp.ok ? 200 : 502, corsHeaders(env));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (url.pathname === '/connect' && request.method === 'GET') {
      return handleConnect(request, env);
    }
    if (url.pathname === '/callback' && request.method === 'GET') {
      return handleCallback(request, env);
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      return handleStatus(request, env);
    }
    if (url.pathname === '/disconnect' && request.method === 'DELETE') {
      return handleDisconnect(request, env);
    }

    return json({ error: 'Not found.' }, 404, corsHeaders(env));
  },
};
