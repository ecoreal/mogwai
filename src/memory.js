// Episodic memories are markdown files with tiny frontmatter.
// Forgetting follows an Ebbinghaus-style decay: w = importance * e^(-days/14).
// Below 0.15 a memory "hibernates" — git mv'd to memory/cold/, recoverable forever.
import { existsSync, readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './brain.js';

const EPI = () => join('memory', 'episodic');
const COLD = () => join('memory', 'cold');
export const HIBERNATE_AT = 0.15;
export const TAU_DAYS = 14;

export const decayWeight = (importance, ageDays) => importance * Math.exp(-ageDays / TAU_DAYS);

export function parseFront(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2].replace(/^\n+/, '') };
}

export function slug(s, n = 22) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n) || 'memory';
}

export function writeEpisodic(brain, text, { importance, tags = [] }) {
  const ts = new Date();
  const title = text.split('\n')[0].slice(0, 60);
  const stamp = ts.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const file = `${stamp}-${slug(title)}.md`;
  const front = `---\nts: ${ts.toISOString()}\nimportance: ${importance}\ntags: ${tags.join(' ')}\n---\n\n`;
  writeFileSync(join(brain.path, EPI(), file), front + text.trim() + '\n');
  return file;
}

export function listEpisodic(brain) {
  const dir = join(brain.path, EPI());
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const raw = readFileSync(join(dir, f), 'utf8');
    const { meta, body } = parseFront(raw);
    return { file: f, ts: meta.ts || '', importance: Number(meta.importance) || 0.5, tags: (meta.tags || '').split(/\s+/).filter(Boolean), body };
  }).sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

function moveToCold(brain, file) {
  const from = join(EPI(), file);
  const to = join(COLD(), file);
  const r = git(brain.path, 'mv', from, to);
  if (!r.ok) renameSync(join(brain.path, from), join(brain.path, to)); // no git? still forget
}

// Lazy sweep: run on any command. Returns hibernated titles.
export function sweepDecay(brain, now = new Date()) {
  const hibernated = [];
  for (const m of listEpisodic(brain)) {
    if (!m.ts) continue;
    const ageDays = (now - new Date(m.ts)) / 864e5;
    if (decayWeight(m.importance, ageDays) < HIBERNATE_AT) {
      moveToCold(brain, m.file);
      hibernated.push(m.body.split('\n')[0].slice(0, 48));
    }
  }
  return hibernated;
}

// Deliberate forgetting: still just a move — nothing is ever really lost.
export function forget(brain, query) {
  const q = query.toLowerCase();
  const moved = [];
  for (const m of listEpisodic(brain)) {
    if (m.body.toLowerCase().includes(q)) {
      moveToCold(brain, m.file);
      moved.push(m.body.split('\n')[0].slice(0, 48));
    }
  }
  return moved;
}

export function remember(brain, fact) {
  const file = join(brain.path, 'memory', 'semantic.md');
  const cur = existsSync(file) ? readFileSync(file, 'utf8') : '# things it knows\n';
  writeFileSync(file, cur.trimEnd() + `\n- ${new Date().toISOString().slice(0, 10)} ${fact.trim()}\n`);
}
