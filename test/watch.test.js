import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWatchFrame } from '../src/watch.js';
import { initBrain, loadBrain } from '../src/brain.js';
import { writeEpisodic } from '../src/memory.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function brain() {
  const dir = mkdtempSync(join(tmpdir(), 'mogwai-watch-'));
  initBrain(dir, 'Watcher');
  const b = loadBrain(dir);
  b.state.bond = 55;
  return { dir, b };
}

test('watch frame: bounded, stage-aware, has bars and hint', () => {
  const { dir, b } = brain();
  const prev = process.env.MOGWAI_BIRTH_OVERRIDE;
  process.env.MOGWAI_BIRTH_OVERRIDE = '40'; // 40 days, bond 55 → adult (>=14 & >=50)
  const lines = buildWatchFrame(b, 80, 24);
  process.env.MOGWAI_BIRTH_OVERRIDE = prev;
  assert.equal(lines.length, 24);
  const text = lines.join('\n');
  assert.match(text, /adult/);
  assert.match(text, /curiosity +█+/);
  assert.match(text, /q quit/);
  for (const l of lines) assert.ok(l.length <= 80);
  rmSync(dir, { recursive: true, force: true });
});

test('watch frame: egg on day zero', () => {
  const { dir, b } = brain();
  const prev = process.env.MOGWAI_BIRTH_OVERRIDE;
  process.env.MOGWAI_BIRTH_OVERRIDE = '0';
  const text = buildWatchFrame(b, 80, 24).join('\n');
  process.env.MOGWAI_BIRTH_OVERRIDE = prev;
  assert.match(text, /egg/);
  rmSync(dir, { recursive: true, force: true });
});

test('feed - reads memory text from stdin (CLI)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mogwai-pipe-'));
  const home = join(dir, 'brain');
  const cli = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'bin', 'mogwai.js');
  execFileSync(process.execPath, [cli, 'init', '--path', home], { encoding: 'utf8' });
  const out = execFileSync(process.execPath, [cli, 'feed', '-', '--path', home], {
    input: 'shipped from a pipe', encoding: 'utf8',
  });
  assert.ok(out.length > 0);
  // empty stdin exits non-zero with a message
  let failed = false;
  try {
    execFileSync(process.execPath, [cli, 'feed', '-', '--path', home], { input: '', encoding: 'utf8' });
  } catch (e) {
    failed = true;
    assert.match(e.stderr || "", /stdin was empty/);
  }
  assert.ok(failed);
  rmSync(dir, { recursive: true, force: true });
});
