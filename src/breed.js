// Breeding: two brains, one egg.
//
// A child is not a copy of its parents — it is a *reading* of them: traits are
// the average of the two, nudged by a deterministic wobble (same two parents and
// same name always give the same child), and it inherits the memories each
// parent held most tightly, with the provenance written into the frontmatter so
// you can always ask where a thought came from.
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { initBrain, loadBrain, saveBrain, commit, git } from './brain.js';
import { listEpisodic, writeEpisodic } from './memory.js';
import { TRAITS } from './personality.js';

export const DEFAULT_INHERIT = 6;      // per parent
export const MAX_FACTS = 24;
const clamp = v => Math.min(0.98, Math.max(0.05, Math.round(v * 1000) / 1000));

// FNV-1a — tiny, stable, and enough for a wobble nobody needs to reproduce on
// another machine by hand.
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The child's traits: the average of two lives, plus a stable ±0.04 wobble. */
export function mixTraits(traitsA, traitsB, nameA, nameB, kidName) {
  const out = {};
  for (const t of TRAITS) {
    const mean = ((traitsA[t] ?? 0.5) + (traitsB[t] ?? 0.5)) / 2;
    const wobble = (hash(`${nameA}|${nameB}|${kidName}|${t}`) % 1000) / 1000 - 0.5; // -0.5..0.5
    out[t] = clamp(mean + wobble * 0.08);
  }
  return out;
}

// The memories a parent would pass on: what it held most tightly, newest first.
const strongest = (brain, n) => listEpisodic(brain)
  .slice()
  .sort((a, b) => (b.importance - a.importance) || (a.ts < b.ts ? 1 : -1))
  .slice(0, n);

function factsOf(path) {
  try {
    return readFileSync(join(path, 'memory', 'semantic.md'), 'utf8').split('\n')
      .filter(l => l.startsWith('- '))
      .map(l => l.slice(2).trim())
      .filter(Boolean);
  } catch { return []; }
}

const snapshot = brain => ({
  name: brain.state.name,
  birth: brain.state.birth,
  traits: brain.traits,
  commit: git(brain.path, 'rev-parse', '--short', 'HEAD').out.trim(),
  origin: brain.path,
});

function isRemote(spec) {
  return /^(https?:\/\/|git@|ssh:\/\/|file:\/\/)/.test(spec) || /\.git$/.test(spec);
}

/** Load a brain from a path, or clone it from a git URL into a temp dir first. */
export function loadParent(spec) {
  if (isRemote(spec)) {
    const dir = mkdtempSync(join(tmpdir(), 'mogwai-parent-'));
    let r = spawnSync('git', ['clone', '--quiet', '--depth', '1', spec, dir], { encoding: 'utf8' });
    if (r.status !== 0) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`cannot clone ${spec}: ${(r.stderr || '').trim().split('\n')[0] || 'git failed'}`);
    }
    const brain = loadBrain(dir);
    if (!brain) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`${spec} is not a mogwai brain (no state.json)`);
    }
    brain.temporary = true;
    return brain;
  }
  const path = resolve(spec);
  const brain = loadBrain(path);
  if (!brain) throw new Error(`${path} is not a mogwai brain (no state.json)`);
  return brain;
}

/**
 * Breed two parents into a new brain at childPath.
 * Throws if the destination already holds a brain (never overwrite a life).
 */
export function breed({ parentA, parentB, childPath, name, inherit = DEFAULT_INHERIT, now = new Date() }) {
  const dest = resolve(childPath);
  if (existsSync(join(dest, 'state.json'))) {
    throw new Error(`a brain already lives at ${dest} — breeding never overwrites a life`);
  }
  const traits = mixTraits(parentA.traits, parentB.traits, parentA.state.name, parentB.state.name, name);
  initBrain(dest, name);

  const child = loadBrain(dest);
  child.traits = traits;
  child.state.birth = now.toISOString();
  child.state.lastEvent = now.toISOString();
  child.state.bond = 0;   // trust is earned, never inherited
  child.state.energy = 100;
  child.state.feeds = 0;
  child.state.mood = 'curious';
  saveBrain(child);

  // memories: the strongest from each side, deduped by body text
  const inherited = [];
  const seen = new Set();
  for (const parent of [parentA, parentB]) {
    for (const m of strongest(parent, inherit)) {
      const key = m.body.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      inherited.push({ m, parent });
    }
  }
  for (const { m, parent } of inherited) {
    writeEpisodic(child, `${m.body.trim()}\n\n> inherited from ${parent.state.name}`, {
      importance: m.importance,
      tags: m.tags,
      ts: now, // the child's clock starts now: an old memory would hibernate on day one
      extra: { from: parent.state.name },
    });
  }

  // facts: the union, parents' lessons first, capped
  const facts = [...new Set([...factsOf(parentA.path), ...factsOf(parentB.path)])].slice(0, MAX_FACTS);
  if (facts.length) {
    writeFileSync(join(dest, 'memory', 'semantic.md'), `# things ${name} knows\n\n${facts.map(f => `- ${f}`).join('\n')}\n`);
  }

  const lineage = {
    self: { name, birth: now.toISOString() },
    parents: [snapshot(parentA), snapshot(parentB)],
    inherited: inherited.length,
  };
  writeFileSync(join(dest, 'parents.json'), JSON.stringify(lineage, null, 2) + '\n');
  writeFileSync(join(dest, 'LINEAGE.md'), lineagePage(lineage, inherited));

  commit(dest, `🐣 ${name} hatched from ${parentA.state.name} × ${parentB.state.name}`);
  return { brain: loadBrain(dest), lineage, inherited: inherited.length, facts: facts.length };
}

function lineagePage(lineage, inherited) {
  const [a, b] = lineage.parents;
  const born = lineage.self.birth.slice(0, 10);
  const lines = [
    `# ${lineage.self.name} — lineage`,
    '',
    '```',
    `${a.name} × ${b.name}`,
    `   └── ${lineage.self.name}  (born ${born})`,
    '```',
    '',
    `- parents: **${a.name}** (born ${a.birth.slice(0, 10)}) × **${b.name}** (born ${b.birth.slice(0, 10)})`,
    `- inherited: ${inherited.length} memorie${inherited.length === 1 ? 'y' : 's'}`,
    '',
    '## what was carried over',
    '',
  ];
  for (const { m, parent } of inherited) {
    lines.push(`- [${m.importance.toFixed(2)}] ${m.body.split('\n')[0].slice(0, 70)}  — from ${parent.state.name}`);
  }
  lines.push('', 'Traits are the average of both parents, nudged by a stable wobble — ', 'breed the same two with the same name and you get the same child.', '');
  return lines.join('\n');
}

/** Ancestry of a brain: walks parents.json as far as local paths allow. */
export function lineageOf(brain, depth = 4) {
  const read = b => {
    try { return JSON.parse(readFileSync(join(b.path, 'parents.json'), 'utf8')); } catch { return null; }
  };
  const node = (brain, level) => {
    const own = read(brain);
    const me = {
      name: brain.state.name,
      birth: brain.state.birth,
      traits: brain.traits,
      bond: brain.state.bond ?? 0,
      parents: [],
      depth: level,
      inherited: own?.inherited ?? 0,
    };
    if (own && level < depth) {
      for (const p of own.parents) {
        let live = null;
        try { if (p.origin && existsSync(join(p.origin, 'state.json'))) live = loadBrain(p.origin); } catch { live = null; }
        me.parents.push(live ? node(live, level + 1) : { name: p.name, birth: p.birth, traits: p.traits, parents: [], depth: level + 1, gone: true });
      }
    }
    return me;
  };
  return node(brain, 0);
}

const AGE = birth => Math.max(0, Math.floor((Date.now() - Date.parse(birth)) / 864e5));

/** The tree as text: me first, then each line of ancestry beneath. */
export function renderLineage(tree) {
  const traitLine = t => TRAITS.map(k => `${k.slice(0, 3)} ${String(Math.round((t?.[k] ?? 0) * 100)).padStart(3)}`).join(' · ');
  const out = [`${tree.name} · ${AGE(tree.birth)}d · bond ${tree.bond}/100   ← you are here`];
  const walk = (node, prefix) => {
    node.parents.forEach((p, i) => {
      const last = i === node.parents.length - 1;
      const mark = last ? '└─' : '├─';
      const inherited = p.inherited ? ` · ${p.inherited} inherited` : '';
      out.push(`${prefix}${mark} ${p.name} · ${AGE(p.birth)}d${p.gone ? ' (elsewhere)' : ''}${inherited}`);
      out.push(`${prefix}${last ? '   ' : '│  '}   ${traitLine(p.traits)}`);
      walk(p, `${prefix}${last ? '   ' : '│  '}`);
    });
  };
  walk(tree, '');
  return out.join('\n');
}
