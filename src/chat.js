// `mogwai chat "..."` — talk about its memories. Context is assembled from
// the warm shelf by keyword overlap (no embeddings, no vector store — the
// brain is files). Offline: it "remembers aloud". With a key: it answers
// in its trait-derived voice.
import { listEpisodic } from './memory.js';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'is', 'was', 'what', 'how', 'why', 'did', 'do', 'you', 'i', 'me', 'my']);

function score(memory, queryWords) {
  const words = memory.body.toLowerCase();
  return queryWords.reduce((s, w) => s + (words.includes(w) ? 1 : 0), 0) + memory.importance * 0.5;
}

export function recallContext(brain, query, n = 3) {
  const q = (query.toLowerCase().match(/[a-z][a-z-]{2,}/g) || []).filter(w => !STOP.has(w));
  if (!q.length) return listEpisodic(brain).slice(0, n);
  return listEpisodic(brain)
    .map(m => ({ m, s: score(m, q) }))
    .sort((a, b) => b.s - a.s)
    .filter(x => x.s >= 1)
    .slice(0, n)
    .map(x => x.m);
}

export function facts(brain, n = 5) {
  const file = join(brain.path, 'memory', 'semantic.md');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(l => l.startsWith('- ')).slice(-n);
}

const FOLLOWUP = /^(--|more\b|that\b)/i;

function loadLast(brain) {
  try { return JSON.parse(readFileSync(join(brain.path, 'memory', 'chat.json'), 'utf8')); } catch { return null; }
}
function saveLast(brain, query, titles) {
  writeFileSync(join(brain.path, 'memory', 'chat.json'), JSON.stringify({ query, titles, at: new Date().toISOString() }, null, 2));
}

export async function chat(brain, query, llm = null) {
  const last = loadLast(brain);
  if (last && FOLLOWUP.test(query.trim())) {
    // continue: re-rank the previous recalled set against the new words
    const all = listEpisodic(brain);
    const prev = all.filter(m => last.titles.includes(m.body.split('\n')[0]));
    const reRanked = recallContext(brain, `${last.query} ${query.replace(/^--\s*/, '')}`)
      .concat(prev.filter(p => !recallContext(brain, query).includes(p)));
    if (reRanked.length) {
      query = `${last.query} ${query.replace(/^--\s*/, '')}`; // context for the LLM path
      var memories = reRanked.slice(0, 3);
    } else {
      var memories = recallContext(brain, query);
    }
  } else {
    var memories = recallContext(brain, query);
  }
  const known = facts(brain);
  if (llm) {
    const context = [
      memories.length ? `relevant memories:\n${memories.map(m => `- ${m.body.split('\n')[0]}`).join('\n')}` : '(no directly relevant memories)',
      known.length ? `things it knows:\n${known.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
    try {
      const reply = await llm(`${query}\n\n---\n${context}`, brain);
      if (reply) return { mode: 'llm', reply, memories };
    } catch { /* fall through to offline */ }
  }
  if (!memories.length) {
    return { mode: 'offline', reply: `…I don't remember anything about that yet. Feed me: mogwai feed "${query.slice(0, 30)}"`, memories: [] };
  }
  saveLast(brain, query, memories.map(m => m.body.split('\n')[0]));
  const lines = memories.map(m => `- ${m.body.split('\n')[0]}`);
  return { mode: 'offline', reply: `that stirs something —\n${lines.join('\n')}`, memories };
}
