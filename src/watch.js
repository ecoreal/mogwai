// `mogwai watch` — the pet, alive: stage art, bars, recent diary. The frame
// builder is pure (testable); the runtime is ~40 lines of raw-mode tty.
import { statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { petStage, statsLines } from './render.js';
import { stageOf, ageDaysOf } from './growth.js';

export function buildWatchFrame(brain, w = 80, h = 24, now = Date.now()) {
  const override = Number(process.env.MOGWAI_BIRTH_OVERRIDE);
  const days = Number.isFinite(override) ? override : ageDaysOf(brain.state.birth, now);
  const stage = stageOf(days, brain.state.bond ?? 0);
  const mood = brain.state.mood || 'curious';
  const lines = petStage(brain.state.name, stage, mood).split('\n');
  lines.push('');
  // trait bars
  for (const t of ['curiosity', 'courage', 'warmth', 'sass', 'focus']) {
    const v = brain.traits[t] ?? 0;
    const filled = Math.round(v * 20);
    lines.push(`${t.padEnd(10)} ${'█'.repeat(filled)}${'░'.repeat(20 - filled)} ${(v * 100).toFixed(0)}%`);
  }
  lines.push('');
  const diary = join(brain.path, 'DIARY.md');
  if (existsSync(diary)) {
    const tail = readFileSync(diary, 'utf8').trimEnd().split('\n').filter(Boolean).slice(-3);
    for (const l of tail) lines.push(l.length > w - 2 ? l.slice(0, w - 3) + '…' : l);
  } else {
    lines.push('(no diary yet — try mogwai diary)');
  }
  lines.push('');
  lines.push(`age ${days}d · bond ${brain.state.bond}/100 · energy ${brain.state.energy}   q quit`);
  while (lines.length < h) lines.push('');
  return lines.slice(0, h).map(l => (l.length > w ? l.slice(0, w) : l));
}

// minimal tty loop — mirrors tape's runtime discipline (no deps)
export async function watch(brain) {
  const out = process.stdout;
  if (!out.isTTY || !process.stdin.isTTY) {
    console.log(buildWatchFrame(brain).join('\n'));
    return;
  }
  process.stdin.setRawMode(true);
  process.stdin.resume();
  out.write('\x1b[?1049h\x1b[?25l\x1b[2J');
  let done = false, timer = null;
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    out.write('\x1b[?25h\x1b[?1049l');
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.removeListener('data', onData);
    resolve();
  };
  let resolve;
  const promise = new Promise(r => (resolve = r));
  const draw = () => {
    const lines = buildWatchFrame(brain, out.columns || 80, out.rows || 24);
    out.write('\x1b[H' + lines.map(l => '\x1b[K' + l).join('\n') + '\x1b[J');
  };
  function onData(buf) {
    if (buf[0] === 3 || buf[0] === 113) return finish(); // ctrl-c / q
    draw();
  }
  process.stdin.on('data', onData);
  timer = setInterval(draw, 2000); // the pet breathes
  process.on('exit', () => { if (!done) out.write('\x1b[?25h\x1b[?1049l'); });
  draw();
  return promise;
}
