// tape — the pet eats your coding sessions. Turns an agent-session JSONL
// into one one-line summary memory. Two dialects, mirroring tape's own
// adapters (intentional duplication — zero imports, sync by hand):
//   tape-native:  {ts, type:'user'|'assistant'|'tool_use'|'tool_result'|
//                 'error'|'system', text, meta}
//   claude-code:  {type:'user'|'assistant', timestamp, message:{role, model,
//                 content: string | [{type:'text'|'thinking'|'tool_use'|
//                 'tool_result', ...}]}}
// Garbage lines (non-JSON, unknown shapes) are swallowed silently — a bad
// night is still a night. The ship/fix/deploy regex mirrors IMPORTANCE in
// personality.js.
import { readFileSync } from 'node:fs';

const TYPES = new Set(['user', 'assistant', 'tool_use', 'tool_result', 'error', 'system']);
// duplicated from personality.js IMPORTANCE (ship rule) — stays dependency-free
const SHIP_RE = /\b(ship|shipped|deploy|deployed|fix|fixed)\b/i;

// claude-code envelope → flat events (subset of tape's adapter: what a
// summary needs — types and first-line text, not full block detail)
function fromClaudeCode(raw, out) {
  const msg = raw.message;
  if (!msg || (typeof msg.content !== 'string' && !Array.isArray(msg.content))) return;
  if (typeof msg.content === 'string') {
    out.push({ type: raw.type === 'assistant' ? 'assistant' : 'user', text: msg.content.trim() });
    return;
  }
  for (const b of msg.content) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text' && b.text) out.push({ type: raw.type === 'assistant' ? 'assistant' : 'user', text: b.text.trim() });
    else if (b.type === 'thinking' && b.thinking) out.push({ type: 'assistant', text: b.thinking.trim() });
    else if (b.type === 'tool_use') out.push({ type: 'tool_use', text: `${b.name || 'tool'} ${JSON.stringify(b.input ?? {}).slice(0, 120)}` });
    else if (b.type === 'tool_result') {
      const body = typeof b.content === 'string' ? b.content
        : Array.isArray(b.content) ? b.content.filter(x => x?.text).map(x => x.text).join('\n') : '';
      out.push({ type: 'tool_result', text: String(body).trim() });
    }
  }
}

export function summarizeTape(jsonl) {
  const events = [];
  for (const line of String(jsonl).split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let raw;
    try { raw = JSON.parse(t); } catch { continue; } // garbage: chew past it
    if (!raw || typeof raw !== 'object') continue;
    if (TYPES.has(raw.type) && raw.text != null) {
      events.push({ type: raw.type, text: String(raw.text).trim() });
    } else if (raw.type === 'error' || raw.level === 'error') {
      events.push({ type: 'error', text: String(raw.message ?? raw.error ?? 'error').trim() });
    } else {
      fromClaudeCode(raw, events); // no-op for unknown shapes
    }
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
