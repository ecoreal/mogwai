// One page per day, appended to DIARY.md. Offline template first;
// LLM polish only if a key exists and the network feels like cooperating.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listEpisodic } from './memory.js';
import { moodOf, topTrait } from './personality.js';
import { polish } from './llm.js';
import { commit } from './brain.js';

const REFLECTIONS = {
  curiosity: ['New things today. Good things.', 'I wonder what tomorrow smells like.'],
  courage: ['Scary things are just future stories.', 'I stood closer to the edge today.'],
  warmth: ['The good shelf got heavier today.', 'Someone was here. I noticed.'],
  sass: ['I am right about more things than yesterday.', 'Documented. You\'re welcome.'],
  focus: ['One thread, pulled all the way through.', 'Quiet hands, loud progress.'],
  sleepy: ['…mm. warm.', 'dreamed in markdown.'],
  proud: ['Some days get a frame around them.', 'I will remember this one longest.'],
};

function reflect(mood, traits, day) {
  const key = mood === 'sleepy' || mood === 'proud' ? mood : topTrait(traits);
  const list = REFLECTIONS[key] || REFLECTIONS.curiosity;
  return list[day % list.length];
}

export async function writeDiary(brain, hibernated = []) {
  const today = new Date().toISOString().slice(0, 10);
  const todays = listEpisodic(brain).filter(m => (m.ts || '').startsWith(today));
  const mood = moodOf(brain.state, brain.traits, todays[0]?.importance ?? 0);

  const bullets = todays.map(m => {
    const bars = '▓'.repeat(Math.round(m.importance * 5)).padEnd(5, '░');
    return `- [${bars}] ${m.body.split('\n')[0].slice(0, 70)}`;
  });
  const faded = hibernated.map(t => `- faded: ${t}`);

  let page = `## ${today} — feeling ${mood}\n\n`;
  page += bullets.length ? bullets.join('\n') + '\n' : '- (a quiet day)\n';
  if (faded.length) page += '\n' + faded.join('\n') + '\n';
  page += `\n> ${reflect(mood, brain.traits, Number(today.slice(-2)))}\n`;

  const voiced = await polish(page, brain.state.name);
  if (voiced) page = voiced.endsWith('\n') ? voiced : voiced + '\n';

  // one page per day: re-running `mogwai diary` rewrites today's page
  const diaryFile = join(brain.path, 'DIARY.md');
  const existing = existsSync(diaryFile) ? readFileSync(diaryFile, 'utf8') : '';
  const withoutToday = existing.replace(new RegExp(`\\n*## ${today}[^\\n]*\\n[\\s\\S]*?(?=\\n## |$)`), '');
  writeFileSync(diaryFile, withoutToday.trimEnd() + '\n\n' + page);

  brain.state.energy = Math.min(100, brain.state.energy + 15);
  brain.state.bond = Math.min(100, brain.state.bond + 1);
  commit(brain.path, `📖 diary: ${today}`);
  return page;
}

export function readDiary(brain, tail = 0) {
  const file = join(brain.path, 'DIARY.md');
  if (!existsSync(file)) return '(no diary yet — try `mogwai diary`)';
  const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
  return (tail ? lines.slice(-tail) : lines).join('\n');
}
