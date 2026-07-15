/**
 * AIWriter — BIK AI Writing Engine
 * Shared service for AI-assisted professional document text.
 * Reusable across Variation Generator, Quotes, Defect Reports, etc.
 *
 * Phase 1: Direct browser → Anthropic API (user supplies own key).
 *
 * AI_WRITING_ENGINE_INTEGRATION_POINT:
 *   In Phase 2, replace _callAPI() with a call to your backend proxy
 *   and replace key management with session auth. No other changes needed.
 *
 * Usage:
 *   import { AIWriter } from '../../toolkit/ai-writer.js';
 *   const writer = new AIWriter();
 *   const result = await writer.write(text, 'professional', { projectName, clientName });
 */

const KEY_STORAGE   = 'bik-ai-key';
const API_URL       = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-haiku-4-5-20251001';
const MAX_TOKENS    = 1024;

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
Output ONLY the corrected text. No preamble, no explanation.`,

  'simplify-client': `You are an expert at making construction language clear and accessible. \
Rewrite the provided text so it is easy for a non-builder client to understand. \
Use plain, everyday language. Avoid construction jargon or technical terms — if you must use one, \
briefly explain it in plain language. Keep it friendly but professional. \
Preserve all facts and the complete meaning. \
Output ONLY the rewritten text. No preamble, no explanation.`,

  formal: `You are an expert in formal Australian business writing. \
Rewrite the provided text in formal business language suitable for official correspondence. \
Use formal vocabulary, correct grammar, and complete sentences. \
Avoid contractions, colloquialisms, and informal language. \
Preserve all facts and the complete meaning. \
Output ONLY the rewritten text. No preamble, no explanation.`,

  'plain-english': `You are an expert technical writer. \
Rewrite the provided text in plain, simple English. \
Use short sentences, everyday words, and active voice. \
Make it easy to understand quickly while preserving all facts and the complete meaning. \
Output ONLY the rewritten text. No preamble, no explanation.`

};

// ── AIWriter class ───────────────────────────────────────────

export class AIWriter {

  constructor() {
    this._cachedKey = null;
  }

  /** Returns the stored API key, or null. */
  getKey() {
    if (this._cachedKey) return this._cachedKey;
    try { this._cachedKey = localStorage.getItem(KEY_STORAGE) || null; } catch (_) {}
    return this._cachedKey;
  }

  /** Store a new API key. */
  setKey(key) {
    this._cachedKey = key ? key.trim() : null;
    try {
      if (this._cachedKey) {
        localStorage.setItem(KEY_STORAGE, this._cachedKey);
      } else {
        localStorage.removeItem(KEY_STORAGE);
      }
    } catch (_) {}
  }

  /** Remove stored API key. */
  clearKey() { this.setKey(null); }

  /** True if an API key is stored. */
  hasKey() { return !!this.getKey(); }

  /**
   * Rewrite text using AI.
   *
   * @param {string} text                           — original text to rewrite
   * @param {'professional'|'contract-protection'|'spell-grammar'|'simplify-client'|'formal'|'plain-english'} mode
   * @param {{ projectName?: string, clientName?: string, toolName?: string }} [context]
   * @returns {Promise<string>} rewritten text
   * @throws {Error} message === 'NO_KEY'      — no API key stored
   * @throws {Error} message === 'INVALID_KEY' — 401 from API
   * @throws {Error} message === string        — other API or network error
   */
  async write(text, mode, context = {}) {
    if (!text?.trim()) throw new Error('No text provided');

    const key = this.getKey();
    if (!key) throw new Error('NO_KEY');

    const system = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.professional;

    const parts = [];
    if (context.projectName) parts.push(`Project: ${context.projectName}`);
    if (context.clientName)  parts.push(`Client: ${context.clientName}`);
    const userMessage = parts.length
      ? `${parts.join('\n')}\n\nText to rewrite:\n${text}`
      : text;

    return this._callAPI(key, system, userMessage);
  }

  /**
   * AI_WRITING_ENGINE_INTEGRATION_POINT
   * Replace this method with a call to your backend proxy in Phase 2.
   * Signature must remain: (key, system, userMessage) => Promise<string>
   */
  async _callAPI(key, system, userMessage) {
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key':                              key,
          'anthropic-version':                      '2023-06-01',
          'content-type':                           'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model:      MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: userMessage }]
        })
      });
    } catch (networkErr) {
      throw new Error('Network error — check your connection and try again.');
    }

    if (!response.ok) {
      if (response.status === 401) throw new Error('INVALID_KEY');
      let msg = `API error ${response.status}`;
      try { const e = await response.json(); msg = e?.error?.message || msg; } catch (_) {}
      throw new Error(msg);
    }

    const data = await response.json();
    const result = data.content?.[0]?.text?.trim();
    if (!result) throw new Error('AI returned an empty response — please try again.');
    return result;
  }
}
