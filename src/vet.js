// `mogwai vet` — a checkup for a brain: git integrity, uncommitted drift,
// memory health (what fades next), and file sanity. Maintainer energy.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, growthRings } from './brain.js';
import { listEpisodic, decayWeight, HIBERNATE_AT, TAU_DAYS } from './memory.js';
import { moodOf } from './personality.js';

export function vet(brainPath) {
  const out = [];
  let problems = 0;

  const push = (icon, line) => out.push(`${icon} ${line}`);
  const bad = line => { problems++; push('✗', line); };

  // 1) file sanity
  for (const f of ['state.json', 'personality.json']) {
    try { JSON.parse(readFileSync(join(brainPath, f), 'utf8')); push('✓', `${f} parses`); }
    catch { bad(`${f} missing or corrupt`); }
  }

  // 2) git integrity
  const fsck = git(brainPath, 'fsck', '--no-progress');
  if (fsck.ok) push('✓', 'git fsck clean');
  else bad('git fsck reported problems');
  const status = git(brainPath, 'status', '--porcelain').out.trim();
  if (status) bad(`uncommitted changes (${status.split('\n').length} files) — run mogwai diary or feed to settle`);
  else push('✓', 'working tree clean');

  // 3) memory health
  const memories = existsSync(join(brainPath, 'memory')) ? listEpisodic({ path: brainPath }) : [];
  const coldDir = join(brainPath, 'memory', 'cold');
  const cold = existsSync(coldDir) ? readdirSync(coldDir).filter(f => f.endsWith('.md')).length : 0;
  const now = Date.now();
  const fading = memories
    .map(m => {
      const ageDays = m.ts ? (now - new Date(m.ts)) / 864e5 : 0;
      const w = decayWeight(m.importance, ageDays);
      const daysLeft = m.importance > 0 ? TAU_DAYS * Math.log(m.importance / HIBERNATE_AT) - ageDays : 0;
      return { title: m.body.split('\n')[0].slice(0, 40), w, daysLeft };
    })
    .sort((a, b) => a.w - b.w)[0];
  push('✓', `memories: ${memories.length} warm · ${cold} hibernated · ${growthRings(brainPath)} commits`);
  if (fading) {
    if (fading.w < HIBERNATE_AT * 2) push('…', `next to fade: "${fading.title}" (~${Math.max(0, fading.daysLeft).toFixed(1)} days)`);
    else push('✓', 'no memory near hibernation');
  }

  // 4) diary
  const diary = join(brainPath, 'DIARY.md');
  const days = existsSync(diary) ? (readFileSync(diary, 'utf8').match(/^## /gm) || []).length : 0;
  push(days ? '✓' : '…', days ? `diary: ${days} day(s) written` : 'diary: nothing yet — try mogwai diary');

  return { lines: out, problems };
}
