import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initBrain } from '../src/brain.js';
import { writeEpisodic } from '../src/memory.js';
import { vet } from '../src/vet.js';

function brainWith() {
  const dir = mkdtempSync(join(tmpdir(), 'mogwai-vet-'));
  initBrain(dir, 'Vet');
  return dir;
}

test('vet passes a fresh, committed brain', () => {
  const dir = brainWith();
  const { lines, problems } = vet(dir);
  assert.equal(problems, 0);
  assert.ok(lines.some(l => l.includes('git fsck clean')));
  assert.ok(lines.some(l => l.includes('working tree clean')));
  rmSync(dir, { recursive: true, force: true });
});

test('vet flags corrupt state, uncommitted drift, and fading memories', () => {
  const dir = brainWith();
  // corrupt personality.json
  writeFileSync(join(dir, 'personality.json'), '{ not json');
  // uncommitted drift: hand-write a memory file without committing
  writeFileSync(join(dir, 'memory', 'episodic', 'zz-drift.md'), '---\nts: 2026-10-25T00:00:00.000Z\nimportance: 0.2\ntags:\n---\n\na trivial note\n');
  const { lines, problems } = vet(dir);
  assert.ok(problems >= 2, `expected >=2 problems, got ${problems}`);
  assert.ok(lines.some(l => l.includes('personality.json missing or corrupt')));
  assert.ok(lines.some(l => l.includes('uncommitted changes')));
  rmSync(dir, { recursive: true, force: true });
});

test('vet predicts the next memory to fade', () => {
  const dir = brainWith();
  const brain = { path: dir };
  // importance 0.2 crosses HIBERNATE_AT after ~21 days; 2 days old → close
  const old = new Date(Date.now() - 2 * 864e5).toISOString();
  writeEpisodic(brain, 'barely matters', { importance: 0.16, tags: [] });
  const files = join(dir, 'memory', 'episodic');
  const f = readdirSync(files)[0];
  writeFileSync(join(files, f), `---\nts: ${old}\nimportance: 0.16\ntags:\n---\n\nbarely matters\n`);
  const { lines } = vet(dir);
  assert.ok(lines.some(l => l.includes('next to fade')));
  rmSync(dir, { recursive: true, force: true });
});
