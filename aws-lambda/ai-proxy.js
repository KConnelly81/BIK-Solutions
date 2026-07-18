/**
 * BIK AI Proxy — AWS Lambda (Function URL)
 *
 * Forwards AI writing requests from the BIK platform to the Anthropic API.
 * The API key is read from the ANTHROPIC_API_KEY environment variable,
 * set in the Lambda console — never committed to source code.
 *
 * Deploy: paste this file's contents into the Lambda console's inline
 * code editor (Code tab, index.mjs), or upload as a .zip. Runtime: Node.js 20.x.
 *
 * Set the API key: Configuration → Environment variables → ANTHROPIC_API_KEY
 * Expose it: Configuration → Function URL → Auth type NONE, CORS configured
 * to allow origin https://biksolutions.com.au, method POST, header content-type.
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://biksolutions.com.au';

// Simple in-memory rate limiting — resets whenever Lambda spins up a new
// execution environment. Good enough to blunt casual abuse; for stricter
// limits, use API Gateway usage plans or WAF instead.
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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export const handler = async (event) => {
  const headers = corsHeaders();
  const method = event.requestContext?.http?.method || 'GET';
  const origin = event.headers?.origin || event.headers?.Origin || '';

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (method !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }
  if (origin && origin !== ALLOWED_ORIGIN) {
    return { statusCode: 403, headers, body: 'Forbidden' };
  }

  const ip = event.requestContext?.http?.sourceIp || 'unknown';
  if (isRateLimited(ip)) {
    return {
      statusCode: 429,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Too many requests — please wait a moment and try again.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request body.' }),
    };
  }

  const { model, max_tokens, system, messages } = body;
  if (!system || !Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required fields: system, messages.' }),
    };
  }

  let anthropicResponse;
  try {
    anthropicResponse = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: max_tokens || 1024,
        system,
        messages,
      }),
    });
  } catch {
    return {
      statusCode: 502,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Network error reaching AI service — please try again.' }),
    };
  }

  const responseBody = await anthropicResponse.text();
  return {
    statusCode: anthropicResponse.status,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: responseBody,
  };
};
