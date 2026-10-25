// `mogwai dream` — consolidation: hibernated (cold) memories are distilled
// into one semantic fact (offline keyword heuristic; LLM polish is roadmap).
import { existsSync, readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { commit } from './brain.js';

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'was', 'were', 'is',
  'are', 'to', 'of', 'in', 'on', 'at', 'it', 'this', 'that', 'we', 'i', 'my', 'our', 'then', 'so']);

function keywords(text, n = 3) {
  const words = text.toLowerCase().match(/[a-z][a-z-]{2,}/g) || [];
  const freq = new Map();
  for (const w of words) if (!STOP.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, n).map(([w]) => w);
}

export function dream(brain) {
  const coldDir = join(brain.path, 'memory', 'cold');
  if (!existsSync(coldDir)) return { dreamed: 0, fact: null };
  const files = readdirSync(coldDir).filter(f => f.endsWith('.md'));
  const fresh = [];
  for (const f of files) {
    const raw = readFileSync(join(coldDir, f), 'utf8');
    if (/^> dreamed /m.test(raw)) continue; // already distilled
    const body = raw.replace(/^---[\s\S]*?---\n?/, '').trim();
    fresh.push({ file: f, body });
  }
  if (!fresh.length) return { dreamed: 0, fact: null };

  const kws = [...new Set(fresh.flatMap(x => keywords(x.body)))].slice(0, 4);
  const today = new Date().toISOString().slice(0, 10);
  const fact = `dreamed: ${kws.join(', ')} (from ${fresh.length} faded memor${fresh.length === 1 ? 'y' : 'ies'})`;
  appendFileSync(join(brain.path, 'memory', 'semantic.md'), `- ${today} ${fact}\n`);
  for (const x of fresh) appendFileSync(join(coldDir, x.file), `\n> dreamed ${today}\n`);
  commit(brain.path, `💭 dreamed: ${kws.slice(0, 2).join(', ')}`);
  return { dreamed: fresh.length, fact };
}
