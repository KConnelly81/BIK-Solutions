/**
 * BIK AI Proxy — Cloudflare Worker
 *
 * Forwards AI writing requests from the BIK platform to the Anthropic API.
 * The API key is stored as a Cloudflare Worker secret (never in source code).
 *
 * Deploy:
 *   wrangler deploy
 *
 * Set the API key (once, stored encrypted by Cloudflare):
 *   wrangler secret put ANTHROPIC_API_KEY
 *
 * Allowed origins are configured in wrangler.toml via ALLOWED_ORIGIN.
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Simple in-memory rate limiting — resets when the Worker instance recycles.
// For production, replace with Cloudflare KV or Durable Objects.
const ipCounts = new Map();
const RATE_LIMIT = 20;        // requests per window per IP
const RATE_WINDOW_MS = 60000; // 1 minute

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    ipCounts.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || 'https://biksolutions.com.au';
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || 'https://biksolutions.com.au';
    const headers = corsHeaders(origin, env);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // Only accept POST from the allowed origin
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers });
    }
    if (origin && origin !== allowed) {
      return new Response('Forbidden', { status: 403, headers });
    }

    // Rate limiting
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests — please wait a moment and try again.' }),
        { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body.' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const { model, max_tokens, system, messages } = body;
    if (!system || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: system, messages.' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Forward to Anthropic
    let anthropicResponse;
    try {
      anthropicResponse = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'x-api-key':         env.ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      model      || 'claude-haiku-4-5-20251001',
          max_tokens: max_tokens || 1024,
          system,
          messages,
        }),
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Network error reaching AI service — please try again.' }),
        { status: 502, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Pass through Anthropic's response (status + body)
    const responseBody = await anthropicResponse.text();
    return new Response(responseBody, {
      status: anthropicResponse.status,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });
  },
};
