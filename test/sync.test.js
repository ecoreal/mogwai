import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bin = join(dirname(), '..', 'bin', 'mogwai.js');
function dirname() {
  return new URL('.', import.meta.url).pathname;
}
const run = (args, env) => execFileSync('node', [bin, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });

test('sync pushes the brain to a remote and is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mogwai-sync-'));
  const remote = join(dir, 'remote.git');
  const home = join(dir, 'brain');
  execFileSync('git', ['init', '-q', '--bare', remote]);
  try {
    run(['init', '--name', 'S'], { MOGWAI_HOME: home });
    run(['feed', 'first sync memory'], { MOGWAI_HOME: home });
    const out1 = run(['sync', '--remote', remote], { MOGWAI_HOME: home });
    assert.match(out1, /pushed/);
    run(['feed', 'second'], { MOGWAI_HOME: home });
    const out2 = run(['sync'], { MOGWAI_HOME: home });
    assert.match(out2, /pushed/);
    const count = execFileSync('git', ['-C', remote, 'rev-list', '--count', 'main'], { encoding: 'utf8' }).trim();
    assert.equal(Number(count), 3); // init + 2 feeds
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sync without a remote explains itself and exits non-zero', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mogwai-noremote-'));
  const home = join(dir, 'brain');
  try {
    run(['init'], { MOGWAI_HOME: home });
    let failed = false;
    try {
      run(['sync'], { MOGWAI_HOME: home });
    } catch (e) {
      failed = true;
      assert.match(e.stdout, /no remote yet/);
    }
    assert.ok(failed, 'should exit non-zero');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
