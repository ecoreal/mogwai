import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initBrain, loadBrain, growthRings, commit } from '../src/brain.js';
import { writeEpisodic, listEpisodic, sweepDecay, parseFront } from '../src/memory.js';
import { TRAITS } from '../src/personality.js';
import { breed, mixTraits, lineageOf, renderLineage, loadParent, DEFAULT_INHERIT, MAX_FACTS } from '../src/breed.js';

const dirs = [];
const tmp = (prefix = 'mogwai-breed-') => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
};
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

function makeBrain(name, memories = [], facts = []) {
  const dir = join(tmp(), name.toLowerCase());
  initBrain(dir, name);
  const brain = loadBrain(dir);
  for (const m of memories) writeEpisodic(brain, m.text, { importance: m.importance ?? 0.6, tags: m.tags ?? [] });
  for (const f of facts) writeFileSync(join(dir, 'memory', 'semantic.md'), readFileSync(join(dir, 'memory', 'semantic.md'), 'utf8') + `- ${f}\n`);
  return loadBrain(dir);
}

function breedInto(a, b, name = 'Pixel', opts = {}) {
  const childPath = join(tmp(), 'kid');
  const r = breed({ parentA: a, parentB: b, childPath, name, ...opts });
  return { ...r, childPath };
}

test('a breed creates a complete, git-versioned life', () => {
  const mom = makeBrain('Momo');
  const dad = makeBrain('Scout');
  const { brain, childPath, lineage } = breedInto(mom, dad);

  assert.equal(brain.state.name, 'Pixel');
  assert.equal(brain.state.bond, 0, 'trust is earned, not inherited');
  assert.equal(brain.state.energy, 100);
  assert.equal(brain.state.feeds, 0);
  assert.ok(existsSync(join(childPath, 'parents.json')));
  assert.ok(existsSync(join(childPath, 'LINEAGE.md')));
  assert.ok(growthRings(childPath) >= 2, 'first breath + the hatch commit');
  assert.equal(lineage.parents.length, 2);
  assert.equal(lineage.parents[0].name, 'Momo');
  assert.ok(lineage.parents[0].commit, 'parent commit recorded for provenance');
});

test('traits are the parents’ average plus a bounded, deterministic wobble', () => {
  const mom = makeBrain('Momo');
  const dad = makeBrain('Scout');
  mom.traits = { curiosity: 0.9, courage: 0.2, warmth: 0.5, sass: 0.1, focus: 0.7 };
  const child = mixTraits(mom.traits, dad.traits, 'Momo', 'Scout', 'Pixel');

  for (const t of TRAITS) {
    const mean = (mom.traits[t] + dad.traits[t]) / 2;
    assert.ok(Math.abs(child[t] - mean) <= 0.04 + 1e-9, `${t} within ±0.04 of the mean`);
    assert.ok(child[t] >= 0.05 && child[t] <= 0.98, `${t} clamped`);
  }
  // same parents + same name ⇒ same child, forever
  assert.deepEqual(mixTraits(mom.traits, dad.traits, 'Momo', 'Scout', 'Pixel'), child);
  // a different name is a different reading of the same two lives
  assert.notDeepEqual(mixTraits(mom.traits, dad.traits, 'Momo', 'Scout', 'Nib'), child);
});

test('the strongest memories from both parents are inherited, with provenance', () => {
  const mom = makeBrain('Momo', [
    { text: 'shipped tape gif', importance: 0.75 },
    { text: 'trivial coffee note', importance: 0.2 },
    { text: 'debugged LZW', importance: 0.6 },
  ]);
  const dad = makeBrain('Scout', [
    { text: 'shipped duel stream', importance: 0.75 },
    { text: 'refactored rope', importance: 0.5 },
  ]);
  const { brain, inherited } = breedInto(mom, dad, 'Pixel', { inherit: 2 });

  const kidMemories = listEpisodic(brain);
  assert.equal(inherited, 4, '2 from each parent');
  assert.equal(kidMemories.length, 4);
  const bodies = kidMemories.map(m => m.body);
  assert.ok(bodies.some(b => b.includes('shipped tape gif')));
  assert.ok(bodies.some(b => b.includes('debugged LZW')));
  assert.ok(!bodies.some(b => b.includes('trivial coffee note')), 'the weakest memory is left behind');
  assert.ok(kidMemories.every(m => m.from), 'frontmatter records the parent');
  assert.ok(kidMemories.every(m => m.body.includes('inherited from')), 'the body says where it came from');

  // fresh clock: an inherited memory must not hibernate on day one
  assert.deepEqual(sweepDecay(brain), []);
});

test('identical memories from both parents are inherited once', () => {
  const mom = makeBrain('Momo', [{ text: 'the same lesson', importance: 0.8 }]);
  const dad = makeBrain('Scout', [{ text: 'The Same Lesson', importance: 0.7 }]);
  const { brain, inherited } = breedInto(mom, dad);
  assert.equal(inherited, 1);
  assert.equal(listEpisodic(brain).length, 1);
});

test('the limit is per parent, and inheritance is capped by it', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ text: `memory ${i}`, importance: 0.5 + i / 100 }));
  const mom = makeBrain('Momo', many);
  const dad = makeBrain('Scout', []);
  const { inherited } = breedInto(mom, dad, 'Pixel', { inherit: 3 });
  assert.equal(inherited, 3);
  assert.equal(listEpisodic(loadBrain(mom.path)).length, 10, 'the parent keeps everything');
  assert.equal(DEFAULT_INHERIT, 6);
});

test('facts are the deduped union of both shelves, capped', () => {
  const mom = makeBrain('Momo', [], ['coffee is a load-bearing wall', 'git is a time machine']);
  const dad = makeBrain('Scout', [], ['git is a time machine', 'tests are love letters']);
  const { brain, facts } = breedInto(mom, dad);
  const shelf = readFileSync(join(brain.path, 'memory', 'semantic.md'), 'utf8');
  assert.equal(facts, 3);
  assert.equal(shelf.match(/git is a time machine/g).length, 1, 'deduped');
  assert.match(shelf, /coffee is a load-bearing wall/);
  assert.match(shelf, /tests are love letters/);
  assert.match(shelf, /# things Pixel knows/);
  assert.equal(MAX_FACTS, 24);
});

test('breeding never overwrites a life', () => {
  const mom = makeBrain('Momo');
  const dad = makeBrain('Scout');
  const childPath = join(tmp(), 'occupied');
  initBrain(childPath, 'Ghost');
  assert.throws(
    () => breed({ parentA: mom, parentB: dad, childPath, name: 'Pixel' }),
    /already lives/,
  );
  assert.equal(loadBrain(childPath).state.name, 'Ghost', 'the resident is untouched');
});

test('loadParent reads a directory and refuses a non-brain', () => {
  const mom = makeBrain('Momo');
  assert.equal(loadParent(mom.path).state.name, 'Momo');
  const empty = tmp();
  mkdirSync(join(empty, 'memory'), { recursive: true });
  assert.throws(() => loadParent(empty), /not a mogwai brain/);
});

test('loadParent can clone a parent from a git URL (file://)', () => {
  const mom = makeBrain('Momo', [{ text: 'a remote lesson', importance: 0.9 }]);
  commit(mom.path, 'lessons');
  const remote = loadParent(`file://${mom.path}`);
  try {
    assert.equal(remote.state.name, 'Momo');
    assert.equal(remote.temporary, true);
    assert.equal(listEpisodic(remote).length, 1);
  } finally {
    rmSync(remote.path, { recursive: true, force: true });
  }
});

test('lineage: a founder has no parents; a child sees both sides', () => {
  const mom = makeBrain('Momo');
  const dad = makeBrain('Scout');
  assert.deepEqual(lineageOf(mom).parents, []);
  const { brain } = breedInto(mom, dad);
  const tree = lineageOf(brain);
  assert.equal(tree.name, 'Pixel');
  assert.deepEqual(tree.parents.map(p => p.name).sort(), ['Momo', 'Scout']);
  const text = renderLineage(tree);
  assert.match(text, /← you are here/);
  assert.match(text, /Momo/);
  assert.match(text, /Scout/);
  assert.ok(text.split('\n').length >= 5);
});

test('lineage walks grandparents when their brains are still on disk', () => {
  const gran = makeBrain('Gran');
  const grandad = makeBrain('Grandad');
  const mom = breed({ parentA: gran, parentB: grandad, childPath: join(tmp(), 'mom'), name: 'Momo' }).brain;
  const dad = makeBrain('Scout');
  const kid = breed({ parentA: mom, parentB: dad, childPath: join(tmp(), 'kid'), name: 'Pixel' }).brain;
  const tree = lineageOf(kid);
  const momNode = tree.parents.find(p => p.name === 'Momo');
  assert.ok(momNode.parents.length === 2, 'Momo still knows her parents');
  assert.deepEqual(momNode.parents.map(p => p.name).sort(), ['Gran', 'Grandad']);
  const text = renderLineage(tree);
  assert.match(text, /Gran/);
  assert.match(text, /Grandad/);
});

test('a missing parent brain degrades to a name, never a crash', () => {
  const mom = makeBrain('Momo');
  const dad = makeBrain('Scout');
  const { brain } = breedInto(mom, dad);
  const parents = JSON.parse(readFileSync(join(brain.path, 'parents.json'), 'utf8'));
  parents.parents[0].origin = '/nonexistent/brain';
  writeFileSync(join(brain.path, 'parents.json'), JSON.stringify(parents));
  const text = renderLineage(lineageOf(brain));
  assert.match(text, /Momo · \d+d \(elsewhere\)/);
  assert.doesNotMatch(text, /Gran/);
});
// ── CLI surface ─────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bin = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'bin', 'mogwai.js');
const cli = (args, env) => execFileSync(process.execPath, [bin, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });

test('CLI: breed prints the hatch, family prints the tree', () => {
  const home = join(tmp(), 'momo-home');
  const scout = join(tmp(), 'scout-home');
  const kid = join(tmp(), 'kid-home');
  cli(['init', '--name', 'Momo'], { MOGWAI_HOME: home });
  cli(['feed', 'shipped a thing'], { MOGWAI_HOME: home });
  cli(['init', '--name', 'Scout'], { MOGWAI_HOME: scout });
  cli(['feed', 'refactored a thing'], { MOGWAI_HOME: scout });

  const out = cli(['breed', scout, '--name', 'Pixel', '--path', kid], { MOGWAI_HOME: home });
  assert.match(out, /Pixel hatched/);
  assert.match(out, /Momo × Scout/);
  const tree = cli(['family', '--path', kid]);
  assert.match(tree, /you are here/);
  assert.match(tree, /Momo/);
  assert.match(tree, /Scout/);
  // the child lives in the same shape as any other brain
  assert.match(cli(['stats', '--path', kid]), /Pixel/);
});

test('CLI: founder family is friendly, not an error', () => {
  const home = join(tmp(), 'founder');
  cli(['init', '--name', 'Solo'], { MOGWAI_HOME: home });
  const out = cli(['family'], { MOGWAI_HOME: home });
  assert.match(out, /Solo is a founder/);
  assert.match(out, /mogwai breed/);
});

test('CLI: breed refuses a missing destination and a self-breed', () => {
  const home = join(tmp(), 'solo-home');
  cli(['init', '--name', 'Solo'], { MOGWAI_HOME: home });
  assert.throws(() => cli(['breed', home, '--name', 'Kid'], { MOGWAI_HOME: home }), /--path/);
  assert.throws(() => cli(['breed', home, '--name', 'Kid', '--path', join(tmp(), 'x')], { MOGWAI_HOME: home }), /cannot breed with itself/);
});
