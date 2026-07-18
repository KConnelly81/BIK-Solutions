/**
 * AIWriter — BIK AI Writing Engine
 * Shared service for AI-assisted professional document text.
 * Reusable across Variation Generator, Quotes, Defect Reports, etc.
 *
 * All requests are routed through the BIK AI proxy (Cloudflare Worker).
 * No API key is stored in the browser or shipped in this file.
 *
 * AI_WRITING_ENGINE_INTEGRATION_POINT:
 *   Update PROXY_URL below after deploying the Cloudflare Worker.
 *   In future, replace with a session-authenticated endpoint.
 *
 * Usage:
 *   import { AIWriter } from '../../toolkit/ai-writer.js';
 *   const writer = new AIWriter();
 *   const result = await writer.write(text, 'professional', { projectName, clientName });
 */

// ── AI_WRITING_ENGINE_INTEGRATION_POINT ─────────────────────────────────────
// Replace this URL with your deployed Cloudflare Worker URL after running:
//   wrangler deploy
// Example: 'https://bik-ai-proxy.<your-account>.workers.dev'
const PROXY_URL  = 'https://bik-ai-proxy.biksolutions.workers.dev';
const MODEL      = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

// ── System prompts per writing mode ─────────────────────────

const SYSTEM_PROMPTS = {

  professional: `You are an expert Australian construction documentation writer. \
Rewrite the provided text into clear, professional Australian construction language \
suitable for formal construction documents.

Rules — follow these exactly:
- Preserve the exact meaning and all facts from the original. Do not add, invent, or assume any information.
- Never expand the scope of work beyond what is stated.
- Never exaggerate costs, entitlements, or urgency.
- Use terminology familiar to Australian residential builders: practical completion, scope of works, \
contract works, latent conditions, provisional sum, and similar.
- Improve grammar, spelling, punctuation, and readability.
- Write in formal third-person or passive voice as appropriate for business documents.
- Output ONLY the rewritten text. No preamble, no explanation, no quotation marks.`,

  'contract-protection': `You are an expert Australian construction documentation writer \
specialising in contract-protective construction documents. Rewrite the provided text to be \
clear, professional, and legally defensible.

Rules — follow these exactly:
- Preserve the exact meaning and all facts from the original. Do not add, invent, or assume any information.
- Never expand the scope of work beyond what is stated.
- Never exaggerate costs, entitlements, or urgency.
- Use terminology familiar to Australian residential builders: practical completion, scope of works, \
contract works, latent conditions, provisional sum, and similar.
- Clearly distinguish between client-requested changes and unforeseen site conditions.
- Reduce ambiguity in scope, entitlement, and responsibility.
- Use factual, defensible language that would hold up in a dispute or adjudication.
- Avoid wording that could be misleading or create unintended legal obligations.
- Reference relevant contract concepts where appropriate.
- Improve grammar, spelling, punctuation, and readability.
- Output ONLY the rewritten text. No preamble, no explanation, no quotation marks.`,

  'spell-grammar': `You are a professional Australian English proofreader. \
Correct all spelling mistakes, grammatical errors, and punctuation issues in the provided text. \
Preserve the original meaning, style, tone, and all factual content exactly. \
Only fix errors — do not rephrase, restructure, or improve style. \
Do not add any facts, figures, names, dates, amounts, or claims not present in the original text. \
If the text cannot be improved without inventing information, return it unchanged. \
Output ONLY the corrected text. No preamble, no explanation.`,

  'simplify-client': `You are an expert at making construction language clear and accessible. \
Rewrite the provided text so it is easy for a non-builder client to understand. \
Use plain, everyday language. Avoid construction jargon or technical terms — if you must use one, \
briefly explain it in plain language. Keep it friendly but professional. \
Do not add any facts, figures, names, dates, amounts, or claims not present in the original text. \
If the text cannot be simplified without inventing information, return it unchanged. \
Output ONLY the rewritten text. No preamble, no explanation.`,

  formal: `You are an expert in formal Australian business writing. \
Rewrite the provided text in formal business language suitable for official correspondence. \
Use formal vocabulary, correct grammar, and complete sentences. \
Avoid contractions, colloquialisms, and informal language. \
Do not add any facts, figures, names, dates, amounts, or claims not present in the original text. \
If the text cannot be formalised without inventing information, return it unchanged. \
Output ONLY the rewritten text. No preamble, no explanation.`,

  'plain-english': `You are an expert technical writer. \
Rewrite the provided text in plain, simple English. \
Use short sentences, everyday words, and active voice. \
Do not add any facts, figures, names, dates, amounts, or claims not present in the original text. \
If the text cannot be simplified without inventing information, return it unchanged. \
Output ONLY the rewritten text. No preamble, no explanation.`

};

// ── AIWriter class ───────────────────────────────────────────

export class AIWriter {

  /**
   * Rewrite text using AI.
   *
   * @param {string} text                           — original text to rewrite
   * @param {'professional'|'contract-protection'|'spell-grammar'|'simplify-client'|'formal'|'plain-english'} mode
   * @param {{ projectName?: string, clientName?: string, toolName?: string }} [context]
   * @returns {Promise<string>} rewritten text
   * @throws {Error} message === 'PROXY_NOT_CONFIGURED' — PROXY_URL placeholder not yet replaced
   * @throws {Error} message === string                  — API or network error
   */
  async write(text, mode, context = {}) {
    if (!text?.trim()) throw new Error('No text provided');

    if (PROXY_URL.includes('<your-account>')) {
      throw new Error('PROXY_NOT_CONFIGURED');
    }

    const system = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.professional;

    const parts = [];
    if (context.projectName) parts.push(`Project: ${context.projectName}`);
    if (context.clientName)  parts.push(`Client: ${context.clientName}`);
    const userMessage = parts.length
      ? `${parts.join('\n')}\n\nText to rewrite:\n${text}`
      : text;

    return this._callProxy(system, userMessage);
  }

  /**
   * AI_WRITING_ENGINE_INTEGRATION_POINT
   * Calls the BIK AI proxy. No API key required here — the Worker holds it.
   * In a future authenticated version, add a session token to the headers.
   */
  async _callProxy(system, userMessage) {
    let response;
    try {
      response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
    } catch {
      throw new Error('Network error — check your connection and try again.');
    }

    if (!response.ok) {
      if (response.status === 429) throw new Error('Too many requests — please wait a moment and try again.');
      let msg = `AI service error (${response.status})`;
      try { const e = await response.json(); msg = e?.error?.message || msg; } catch (_) {}
      throw new Error(msg);
    }

    const data = await response.json();
    const result = data.content?.[0]?.text?.trim();
    if (!result) throw new Error('AI returned an empty response — please try again.');
    return result;
  }

  // ── Key management methods kept for backward compatibility ───────────────
  // These are no-ops now that the proxy holds the key. Safe to remove in a
  // future cleanup once all callers have been updated.
  getKey()   { return null; }
  hasKey()   { return true; }  // proxy is always available once deployed
  setKey()   {}
  clearKey() {}
}
