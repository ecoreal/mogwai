// Optional voice: any OpenAI-compatible endpoint. No key? Everything still
// works — the diary falls back to offline templates. Offline-first is the point.
export function hasKey() {
  return !!(process.env.MOGWAI_API_KEY || process.env.OPENAI_API_KEY);
}

import { voicePrompt } from './personality.js';

export async function polish(page, brain) {
  const key = process.env.MOGWAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  const base = (process.env.MOGWAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.MOGWAI_MODEL || 'gpt-4o-mini';
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          // the pet's grown traits ARE the system prompt
          { role: 'system', content: voicePrompt(brain.state.name, brain.traits, brain.state.mood || 'curious', brain.state.bond) },
          { role: 'user', content: page },
        ],
        max_tokens: 2000,
        temperature: 0.9,
      }),
      signal: AbortSignal.timeout(Number(process.env.MOGWAI_TIMEOUT_MS) || 8000),
    });
    const j = await res.json();
    const text = j.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null; // offline, rate-limited, whatever — template voice it is
  }
}
