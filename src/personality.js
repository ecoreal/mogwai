// Personality is five floats that drift with what actually happens to the pet.
// No system prompt says "you are sassy" — it becomes sassy by living.
const clamp = v => Math.min(0.98, Math.max(0.05, Math.round(v * 1000) / 1000));

export const TRAITS = ['curiosity', 'courage', 'warmth', 'sass', 'focus'];

const RULES = [
  { re: /\b(ship|shipped|deploy|release|launch|fix|fixed|bug)\b/i, trait: 'courage', d: 0.04 },
  { re: /\b(explore|tried|try|learn|learned|read|research|discover)\b/i, trait: 'curiosity', d: 0.04 },
  { re: /\b(help|helped|thank|pair|chat|talk|meet|call)\b/i, trait: 'warmth', d: 0.03 },
  { re: /\b(refactor|test|write|build|focus|deep)\b/i, trait: 'focus', d: 0.03 },
  { re: /.*/, trait: 'sass', d: 0.005 }, // every day, a little more opinionated
];

const IMPORTANCE = [
  { re: /\b(fail|failed|bug|crash|lesson|learned|debug|production)\b/i, v: 0.85, tags: ['lesson'] },
  { re: /\b(ship|shipped|deploy|release|launch)\b/i, v: 0.75, tags: ['ship'] },
  { re: /\b(meet|talk|chat|call|pair)\b/i, v: 0.5, tags: ['social'] },
];

export function classify(text) {
  for (const r of IMPORTANCE) if (r.re.test(text)) return { importance: r.v, tags: r.tags };
  return { importance: 0.55, tags: [] };
}

export function drift(traits, text) {
  const next = { ...traits };
  for (const r of RULES) if (r.re.test(text)) next[r.trait] = clamp(next[r.trait] + r.d);
  return next;
}

export const topTrait = traits =>
  TRAITS.reduce((a, b) => (traits[b] > traits[a] ? b : a), TRAITS[0]);

const TRAIT_MOODS = {
  curiosity: 'curious', courage: 'fearless', warmth: 'cozy',
  sass: 'smug', focus: 'in-the-zone',
};

export function moodOf(state, traits, lastImportance = 0) {
  if (state.energy < 25) return 'sleepy';
  if (lastImportance >= 0.75) return 'proud';
  return TRAIT_MOODS[topTrait(traits)];
}

export const REACTIONS = {
  sleepy: ['*yawn* …filed it. Under the pillow.',
    'noted. barely. zzz.',
    'mm. remembered in my sleep.'],
  curious: ['ooh, filing that next to seventeen related thoughts.',
    'interesting… tell me more tomorrow.',
    'cross-referencing with everything I already know. done.'],
  fearless: ['logged. I would have shipped that too.',
    'bold. noted, permanently.',
    'that goes in the spine, not the margins.'],
  cozy: ['aw. putting that somewhere warm.',
    'kept. safely. with the good ones.',
    'that one gets a blanket.'],
  smug: ['oh? *another* thing I get to be right about. filed.',
    'sure. added it to the obviously-correct pile.',
    'noted. I have opinions about it, but noted.'],
  'in-the-zone': ['filed. did not blink.',
    'index updated. next.',
    'stored. I was already thinking about this.'],
  proud: ['THAT goes on the first page.',
    'big one. underlined twice.',
    'framed. mentally.'],
};

export function reaction(mood) {
  const list = REACTIONS[mood] || REACTIONS.cozy;
  return list[Math.floor(Math.random() * list.length)];
}

const LEVELS = ['stranger', 'acquaintance', 'companion', 'friend', 'bestie', 'soulmate'];
export const bondLevel = bond => LEVELS[Math.min(LEVELS.length - 1, Math.floor(bond / 20))];
