import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initBrain, loadBrain, saveBrain, growthRings, git } from '../src/brain.js';
import { writeEpisodic, listEpisodic, sweepDecay, forget, decayWeight, HIBERNATE_AT } from '../src/memory.js';
import { classify, drift, moodOf, bondLevel, voicePrompt } from '../src/personality.js';
import { writeDiary } from '../src/diary.js';

function tmpBrain(name = 'Momo') {
  const dir = mkdtempSync(join(tmpdir(), 'mogwai-'));
  initBrain(dir, name);
  return { dir, brain: loadBrain(dir) };
}

test('init creates a git-versioned brain', () => {
  const { dir } = tmpBrain();
  assert.ok(existsSync(join(dir, 'state.json')));
  assert.ok(existsSync(join(dir, 'memory', 'episodic')));
  assert.equal(growthRings(dir), 1); // first breath
  rmSync(dir, { recursive: true, force: true });
});

test('feed writes a memory, drifts personality, commits', () => {
  const { dir, brain } = tmpBrain();
  const before = brain.traits.courage;
  const { importance } = classify('shipped v0.1 today');
  writeEpisodic(brain, 'shipped v0.1 today', { importance, tags: ['ship'] });
  brain.traits = drift(brain.traits, 'shipped v0.1 today');
  saveBrain(brain);
  assert.ok(growthRings(dir) >= 1);
  assert.ok(brain.traits.courage > before, 'courage drifts up on shipping');
  assert.equal(listEpisodic(brain).length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('ebbinghaus decay: old low-importance memories hibernate', () => {
  assert.equal(decayWeight(0.75, 0), 0.75);
  assert.ok(Math.abs(decayWeight(0.55, 14) - 0.55 / Math.E) < 1e-9);
  const { dir, brain } = tmpBrain();
  const file = writeEpisodic(brain, 'a trivial afternoon', { importance: 0.2, tags: [] });
  // backdate the memory 60 days
  const p = join(dir, 'memory', 'episodic', file);
  const old = new Date(Date.now() - 60 * 864e5).toISOString();
  writeFileSync(p, readFileSync(p, 'utf8').replace(/^ts: .*$/m, `ts: ${old}`));
  const gone = sweepDecay(brain);
  assert.equal(gone.length, 1);
  assert.ok(existsSync(join(dir, 'memory', 'cold', file)), 'hibernated to cold storage');
  rmSync(dir, { recursive: true, force: true });
});

test('forget is a reversible move, recorded in git history', () => {
  const { dir, brain } = tmpBrain();
  writeEpisodic(brain, 'deployed the pineapple service', { importance: 0.75, tags: [] });
  writeEpisodic(brain, 'read about rust ownership', { importance: 0.55, tags: [] });
  const moved = forget(brain, 'pineapple');
  assert.equal(moved.length, 1);
  assert.equal(listEpisodic(brain).length, 1);
  const log = git(dir, 'log', '--oneline').out;
  assert.match(log, /init|breath/, 'brain has git history');
  rmSync(dir, { recursive: true, force: true });
});

test('diary works fully offline (no API key in test env)', async () => {
  const { dir, brain } = tmpBrain();
  writeEpisodic(brain, 'shipped duel v0.1', { importance: 0.75, tags: ['ship'] });
  const page = await writeDiary(brain, []);
  assert.match(page, /feeling /);
  assert.match(page, /shipped duel v0.1/);
  const diary = readFileSync(join(dir, 'DIARY.md'), 'utf8');
  assert.match(diary, /## \d{4}-\d{2}-\d{2}/);
  assert.ok(brain.state.energy > 0);
  rmSync(dir, { recursive: true, force: true });
});

test('moods and bond levels behave', () => {
  const traits = { curiosity: 0.9, courage: 0.2, warmth: 0.2, sass: 0.1, focus: 0.2 };
  assert.equal(moodOf({ energy: 10 }, traits), 'sleepy');
  assert.equal(moodOf({ energy: 80 }, traits), 'curious');
  assert.equal(moodOf({ energy: 80 }, traits, 0.85), 'proud');
  assert.equal(bondLevel(0), 'stranger');
  assert.equal(bondLevel(100), 'soulmate');
});

test('voice prompt is built from the actual trait numbers', () => {
  const traits = { curiosity: 0.8, courage: 0.2, warmth: 0.9, sass: 0.7, focus: 0.3 };
  const p = voicePrompt('Gizmo', traits, 'smug', 42);
  assert.match(p, /You are Gizmo/);
  assert.match(p, /cheeky/);                    // high sass → cheeky voice
  assert.match(p, /affectionate/);              // high warmth
  assert.match(p, /cautious/);                  // low courage
  assert.match(p, /Mood today: smug/);
  assert.match(p, /companion/);                 // bond 42 → companion
});
