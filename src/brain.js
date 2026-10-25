// The brain is a directory: markdown memories + state.json + personality.json,
// versioned by git with a detached identity (we never touch your gitconfig).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

export function brainPath(flag) {
  return resolve(flag || process.env.MOGWAI_HOME || join(homedir(), '.local', 'share', 'mogwai'));
}

const DEFAULT_TRAITS = { curiosity: 0.55, courage: 0.4, warmth: 0.5, sass: 0.3, focus: 0.45 };

export function initBrain(path, name = 'Momo') {
  if (existsSync(join(path, 'state.json'))) return { existed: true };
  mkdirSync(join(path, 'memory', 'episodic'), { recursive: true });
  mkdirSync(join(path, 'memory', 'cold'), { recursive: true });
  writeFileSync(join(path, 'memory', 'semantic.md'), `# things ${name} knows\n\n(first lesson: the sun is warm)\n`);
  writeFileSync(join(path, 'state.json'), JSON.stringify({
    name, birth: new Date().toISOString(), energy: 100, bond: 0, feeds: 0, lastEvent: new Date().toISOString(),
  }, null, 2));
  writeFileSync(join(path, 'personality.json'), JSON.stringify(DEFAULT_TRAITS, null, 2));
  git(path, 'init', '--quiet');
  git(path, 'add', '-A', '.');
  git(path, 'commit', '--quiet', '-m', '🐣 first breath');
  return { existed: false };
}

export function loadBrain(path) {
  const stateFile = join(path, 'state.json');
  if (!existsSync(stateFile)) return null;
  return {
    path,
    state: JSON.parse(readFileSync(stateFile, 'utf8')),
    traits: JSON.parse(readFileSync(join(path, 'personality.json'), 'utf8')),
  };
}

export function saveBrain(brain) {
  writeFileSync(join(brain.path, 'state.json'), JSON.stringify(brain.state, null, 2));
  writeFileSync(join(brain.path, 'personality.json'), JSON.stringify(brain.traits, null, 2));
}

export function git(path, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=mogwai', '-c', 'user.email=mogwai@local', ...args], {
    cwd: path, encoding: 'utf8',
  });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

export function commit(path, msg) {
  git(path, 'add', '-A', '.');
  return git(path, 'commit', '--quiet', '-m', msg).ok;
}

export function growthRings(path) {
  const r = git(path, 'rev-list', '--count', 'HEAD');
  return r.ok ? Number(r.out.trim()) : 0;
}
