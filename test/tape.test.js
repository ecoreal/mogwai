import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initBrain, loadBrain, git } from '../src/brain.js';
import { listEpisodic } from '../src/memory.js';
import { summarizeTape } from '../src/tape.js';

const bin = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'bin', 'mogwai.js');
const run = (args, env) => execFileSync(process.execPath, [bin, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });

const line = (type, text, ts = '2026-10-26T09:00:00Z') => JSON.stringify({ ts, type, text });
const session = (...lines) => lines.join('\n') + '\n';

function tmpBrain(name = 'Tapey') {
  const dir = mkdtempSync(join(tmpdir(), 'mogwai-tape-'));
  initBrain(dir, name);
  return dir;
}

test('summarizeTape: headline, steps, tools, errors, importance', () => {
  const s = summarizeTape(session(
    line('system', 'session start'),
    line('user', 'explore the replication lag'),
    line('assistant', 'reading the wal sender code'),
    line('tool_use', 'read src/wal.js'),
    line('tool_result', '42 lines'),
    line('tool_use', 'grep lag'),
    line('tool_result', '3 hits'),
    line('error', 'timeout'),
  ));
  assert.equal(s.headline, 'explore the replication lag');
  assert.equal(s.steps, 8);
  assert.equal(s.tools, 2);
  assert.equal(s.errors, 1);
  assert.equal(s.importance, 0.55); // no ship words, only one error
});

test('summarizeTape: headline is the first user message, truncated to 60', () => {
  const s = summarizeTape(session(line('assistant', 'earlier noise'), line('user', 'x'.repeat(100))));
  assert.equal(s.headline.length, 60);
});

test('summarizeTape: error-heavy session is a rough night (0.75)', () => {
  const s = summarizeTape(session(
    line('user', 'why is prod down'),
    line('error', 'ECONNREFUSED'),
    line('error', 'oom killed'),
    line('error', 'retry failed'),
  ));
  assert.equal(s.importance, 0.75);
});

test('summarizeTape: ship/fix/deploy in user text raises importance to 0.75', () => {
  const s = summarizeTape(session(line('user', 'ship the release today'), line('assistant', 'on it')));
  assert.equal(s.importance, 0.75);
});

test('summarizeTape: garbage lines are swallowed silently', () => {
  const s = summarizeTape([
    'not json at all',
    '{"type":"user","text":"real message"}',
    '',
    '   ',
    '{"nonsense":true}',
    '{"type":"weird","text":"unknown type"}',
    '[1,2,3]',
    'null',
    line('assistant', 'ok'),
  ].join('\n'));
  assert.equal(s.headline, 'real message');
  assert.equal(s.steps, 2);
  assert.equal(s.tools, 0);
  assert.equal(s.importance, 0.55);
});

test('summarizeTape: zero user messages falls back to first non-tool event', () => {
  const s = summarizeTape(session(
    line('tool_use', 'ls'),
    line('tool_result', 'files'),
    line('assistant', 'the build is green'),
    line('tool_use', 'cat Makefile'),
  ));
  assert.equal(s.headline, 'the build is green');
});

test('feed --tape writes the summary memory and commits (CLI)', () => {
  const dir = tmpBrain();
  const home = join(dir, 'brain');
  const tapeFile = join(dir, 'session.jsonl');
  writeFileSync(tapeFile, session(
    line('user', 'explore the replication lag'),
    line('assistant', 'reading the wal sender code'),
    line('tool_use', 'read src/wal.js'),
    line('tool_result', '42 lines'),
    line('tool_use', 'grep lag'),
    line('tool_result', '3 hits'),
  ));
  try {
    run(['init', '--name', 'Tapey'], { MOGWAI_HOME: home });
    run(['feed', '--tape', tapeFile], { MOGWAI_HOME: home });
    const mems = listEpisodic(loadBrain(home));
    assert.equal(mems.length, 1);
    assert.match(mems[0].body, /^coded with tape: explore the replication lag \(6 steps · 2 tools · 0 errors\)\n$/);
    assert.equal(mems[0].importance, 0.55);
    const log = git(home, 'log', '--oneline').out;
    assert.match(log, /🌱 lived through a coding session: explore the replication lag/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('feed --tape: error-heavy session lands at importance 0.75 (CLI)', () => {
  const dir = tmpBrain();
  const home = join(dir, 'brain');
  const tapeFile = join(dir, 'rough.jsonl');
  writeFileSync(tapeFile, session(
    line('user', 'why is prod down'),
    line('error', 'ECONNREFUSED'),
    line('error', 'oom killed'),
  ));
  try {
    run(['init'], { MOGWAI_HOME: home });
    run(['feed', '--tape', tapeFile], { MOGWAI_HOME: home });
    const mems = listEpisodic(loadBrain(home));
    assert.equal(mems.length, 1);
    assert.equal(mems[0].importance, 0.75);
    assert.match(mems[0].body, /\(3 steps · 0 tools · 2 errors\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('feed --tape: missing file fails cleanly with exit 1', () => {
  const dir = tmpBrain();
  const home = join(dir, 'brain');
  try {
    run(['init'], { MOGWAI_HOME: home });
    let failed = false;
    try {
      run(['feed', '--tape', join(dir, 'nope.jsonl')], { MOGWAI_HOME: home });
    } catch (e) {
      failed = true;
      assert.match(String(e.stderr), /feed --tape: cannot read .*nope\.jsonl \(no such file\)/);
    }
    assert.ok(failed, 'should exit non-zero');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('feed --tape: zero-user session still works via fallback headline (CLI)', () => {
  const dir = tmpBrain();
  const home = join(dir, 'brain');
  const tapeFile = join(dir, 'noise.jsonl');
  writeFileSync(tapeFile, session(
    line('tool_use', 'ls'),
    line('tool_result', 'files'),
    line('assistant', 'the build is green'),
  ));
  try {
    run(['init'], { MOGWAI_HOME: home });
    run(['feed', '--tape', tapeFile], { MOGWAI_HOME: home });
    const mems = listEpisodic(loadBrain(home));
    assert.equal(mems.length, 1);
    assert.match(mems[0].body, /coded with tape: the build is green/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('claude-code dialect: envelope messages count as steps', async () => {
  const { summarizeTape } = await import('../src/tape.js');
  const jsonl = [
    JSON.stringify({ type: 'user', timestamp: 't', message: { role: 'user', content: 'find the login bug' } }),
    JSON.stringify({ type: 'assistant', timestamp: 't', message: { role: 'assistant', content: [
      { type: 'text', text: 'on it' },
      { type: 'tool_use', id: 'x', name: 'Bash', input: { command: 'npm test' } },
    ] } }),
    JSON.stringify({ type: 'user', timestamp: 't', message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 'x', content: [{ type: 'text', text: '1 failed' }] },
    ] } }),
  ].join('\n');
  const s = summarizeTape(jsonl);
  assert.equal(s.steps, 4);
  assert.equal(s.tools, 1);
  assert.match(s.headline, /find the login bug/);
});

test('openclaw sessions are edible: toolCall blocks, toolResult, isError', async () => {
  const { summarizeTape } = await import('../src/tape.js');
  const lines = [
    { type: 'session', version: 3 },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'the logout button 500s, find it' }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'reading both handlers' }, { type: 'toolCall', id: 'c1', name: 'read', arguments: { path: 'a.ts' } }] } },
    { type: 'message', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'read', isError: false, content: [{ type: 'text', text: 'ok' }] } },
    { type: 'message', message: { role: 'toolResult', toolCallId: 'c2', toolName: 'bash', isError: true, content: [{ type: 'text', text: 'npm test: 2 failing' }] } },
  ].map(o => JSON.stringify(o)).join('\n');
  const s = summarizeTape(lines);
  assert.equal(s.headline, 'the logout button 500s, find it');
  assert.equal(s.steps, 5, 'user + text + toolCall + toolResult + error; the session header is bookkeeping');
  assert.equal(s.tools, 1);
  assert.equal(s.errors, 1, 'isError:true is a rough patch, not a normal result');
});

test('an openclaw rough night weighs more than a smooth one', async () => {
  const { summarizeTape } = await import('../src/tape.js');
  const mk = (errs) => [
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'refactor the parser' }] } },
    ...Array.from({ length: errs }, (_, i) => ({ type: 'message', message: { role: 'toolResult', toolCallId: `c${i}`, isError: true, content: [{ type: 'text', text: `boom ${i}` }] } })),
  ].map(o => JSON.stringify(o)).join('\n');
  assert.equal(summarizeTape(mk(0)).importance, 0.55);
  assert.equal(summarizeTape(mk(2)).importance, 0.75);
  assert.deepEqual(summarizeTape(mk(2)).tags, ['lesson']);
});
