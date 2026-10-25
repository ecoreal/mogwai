// tape — the pet eats your coding sessions. Turns an agent-session JSONL
// (tape-native format: {ts, type:'user'|'assistant'|'tool_use'|'tool_result'|
// 'error'|'system', text, meta}) into one one-line summary memory.
// Garbage lines (non-JSON, unknown shapes) are swallowed silently — a bad
// night is still a night. Kept standalone on purpose: the ship/fix/deploy
// regex below intentionally mirrors the IMPORTANCE rules of classify() in
// personality.js (tiny duplication, zero imports — sync by hand if they change).
import { readFileSync } from 'node:fs';

const TYPES = new Set(['user', 'assistant', 'tool_use', 'tool_result', 'error', 'system']);
// duplicated from personality.js IMPORTANCE (ship rule) — stays dependency-free
const SHIP_RE = /\b(ship|shipped|deploy|deployed|fix|fixed)\b/i;

export function summarizeTape(jsonl) {
  const events = [];
  for (const line of String(jsonl).split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let raw;
    try { raw = JSON.parse(t); } catch { continue; } // garbage: chew past it
    if (!raw || typeof raw !== 'object' || !TYPES.has(raw.type) || raw.text == null) continue;
    events.push({ type: raw.type, text: String(raw.text).trim() });
  }
  const steps = events.length; // a step is any parsed event line
  const tools = events.filter(e => e.type === 'tool_use').length;
  const errors = events.filter(e => e.type === 'error').length;
  const userText = events.filter(e => e.type === 'user').map(e => e.text).join('\n');
  const firstSpoken = events.find(e => e.type !== 'tool_use' && e.type !== 'tool_result');
  const headline = (events.find(e => e.type === 'user')?.text || firstSpoken?.text || '')
    .split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 60) || '(a quiet session)';
  // importance: rough nights and ship words matter more (mirrors classify())
  let importance = 0.55, tags = [];
  if (errors >= 2) { importance = 0.75; tags = ['lesson']; } // a rough night
  else if (SHIP_RE.test(userText)) { importance = 0.75; tags = ['ship']; }
  return { headline, steps, tools, errors, importance, tags };
}

export function summarizeTapeFile(path) {
  return summarizeTape(readFileSync(path, 'utf8'));
}
