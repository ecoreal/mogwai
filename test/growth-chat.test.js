import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageOf, ageDaysOf, STAGES } from '../src/growth.js';
import { FACES_STAGE } from '../src/render.js';
import { chat } from '../src/chat.js';
import { initBrain, loadBrain } from '../src/brain.js';
import { writeEpisodic } from '../src/memory.js';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('stageOf: the age+bond ladder, boundary-exact', () => {
  assert.equal(stageOf(0, 0), 'egg');
  assert.equal(stageOf(0.5, 50), 'egg');       // <1 day: egg regardless of bond
  assert.equal(stageOf(1, 0), 'hatchling');
  assert.equal(stageOf(3, 10), 'sprout');
  assert.equal(stageOf(3, 9), 'hatchling');    // bond gate
  assert.equal(stageOf(7, 25), 'young');
  assert.equal(stageOf(14, 50), 'adult');
  assert.equal(stageOf(30, 80), 'elder');
  assert.equal(stageOf(30, 79), 'adult');      // bond gate
  assert.ok(STAGES.length === 6);
});

test('ageDaysOf: floors to whole days, tolerates bad input', () => {
  const t = new Date('2026-10-25T00:00:00Z').getTime();
  assert.equal(ageDaysOf('2026-10-24T12:00:00Z', t), 0);
  assert.equal(ageDaysOf('2026-09-25T00:00:00Z', t), 30);
  assert.equal(ageDaysOf('not-a-date', t), 0);
});

test('every stage has a distinct face silhouette', () => {
  const shapes = new Set(STAGES.map(s => FACES_STAGE[s].join('|')));
  assert.equal(shapes.size, 6);
});

test('chat continuity: follow-ups ride the previous recall set', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mogwai-cont-'));
  initBrain(dir, 'Cont');
  const brain = loadBrain(dir);
  writeEpisodic(brain, 'the redis cache kept expiring too early', { importance: 0.6, tags: [] });
  writeEpisodic(brain, 'shipped the login fix after lunch', { importance: 0.75, tags: [] });

  const first = await chat(brain, 'the redis cache');
  assert.ok(first.memories.length >= 1);
  assert.ok(existsSync(join(dir, 'memory', 'chat.json')), 'last exchange persisted');

  const more = await chat(brain, 'more');
  assert.ok(more.memories.length >= 1);
  assert.match(more.memories[0].body, /redis|login/); // rides or falls back gracefully

  const fresh = await chat(brain, 'quantum giraffe thermodynamics');
  assert.match(fresh.reply, /don.t remember/);
  // design: failed recall leaves continuity untouched (empty lookups must
  // not clobber the context a follow-up would ride)
  const last = JSON.parse(readFileSync(join(dir, 'memory', 'chat.json'), 'utf8'));
  assert.equal(last.query, 'the redis cache more');
  rmSync(dir, { recursive: true, force: true });
});

test('mogwai pet: oneline and face variants (CLI)', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const cli = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'bin', 'mogwai.js');
  const dir = mkdtempSync(join(tmpdir(), 'mogwai-pet-'));
  const env = { ...process.env, MOGWAI_HOME: join(dir, 'brain'), MOGWAI_BIRTH_OVERRIDE: '0' };
  execFileSync(process.execPath, [cli, 'init', '--name', 'Pico', '--path', join(dir, 'brain')], { encoding: 'utf8' });
  const one = execFileSync(process.execPath, [cli, 'pet', '--oneline', '--path', join(dir, 'brain')], { encoding: 'utf8', env });
  assert.match(one, /^\( o\.o \) Pico · egg · /);
  const full = execFileSync(process.execPath, [cli, 'pet', '--path', join(dir, 'brain')], { encoding: 'utf8', env });
  assert.match(full, /\( o\.o \)/);
  assert.match(full, /← Pico, egg/);
  rmSync(dir, { recursive: true, force: true });
});

test('mogwai adopt: clones a synced brain, resets bond, refuses non-brains', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const cli = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'bin', 'mogwai.js');
  const base = mkdtempSync(join(tmpdir(), 'mogwai-adopt-'));
  const src = join(base, 'src'), remote = join(base, 'r.git'), dst = join(base, 'dst');
  execFileSync('git', ['init', '-q', '--bare', remote]);
  const env = { ...process.env, MOGWAI_HOME: src };
  execFileSync(process.execPath, [cli, 'init', '--name', 'Roam', '--path', src], { encoding: 'utf8' });
  execFileSync(process.execPath, [cli, 'feed', 'adopted memory one', '--path', src], { encoding: 'utf8', env });
  execFileSync(process.execPath, [cli, 'sync', '--remote', remote, '--path', src], { encoding: 'utf8', env });
  const out = execFileSync(process.execPath, [cli, 'adopt', remote, '--path', dst], { encoding: 'utf8' });
  assert.match(out, /Roam moved in/);
  assert.match(out, /bond reset/);
  const adopted = loadBrain(dst);
  assert.equal(adopted.state.bond, 0);
  assert.equal(adopted.state.name, 'Roam');
  rmSync(base, { recursive: true, force: true });
});
