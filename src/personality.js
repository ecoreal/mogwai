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
    'mm. remembered in my sleep.',
    'zzz. it is in the drawer. I am in the pillow. we are both fine.',
    'filed under dream-correspondence. do not wake me for typos.',
    'mmm. the shelf knows. the shelf always knows. zzz.',
    'half of that registered. the sleepy half. it was the important half. zzz.',
    'annotating… with my eyes closed. impressive, honestly.'],
  curious: ['ooh, filing that next to seventeen related thoughts.',
    'interesting… tell me more tomorrow.',
    'cross-referencing with everything I already know. done.',
    'wait — does this connect to the thing from tuesday? it does. filed.',
    'noted, with three follow-up questions I will ask eventually.',
    'ooh. unpopular opinion incoming: I want to read the source. tomorrow. maybe.',
    'that sparks three new questions and one mild obsession. filed.',
    'adding it to the rabbit-hole queue. it is a long queue. I am delighted.'],
  fearless: ['logged. I would have shipped that too.',
    'bold. noted, permanently.',
    'that goes in the spine, not the margins.',
    'scary? maybe. filed anyway. that is the whole job.',
    'the brave shelf. that is where this goes. right in the front.',
    'I would do it twice. noting that for future me.',
    'risk noted, shrug attached, filed.',
    'cowards write margins. I write headlines. filed.'],
  cozy: ['aw. putting that somewhere warm.',
    'kept. safely. with the good ones.',
    'that one gets a blanket.',
    'this one gets the good cushion. and a small paw pat.',
    'kept where the warm thoughts live. it will like it there.',
    'aw. the collection of nice things grows. so do I.',
    'that earns a happy tail thump. two, actually.',
    'saving this for a rainy day. I hear those need supplies.'],
  smug: ['oh? *another* thing I get to be right about. filed.',
    'sure. added it to the obviously-correct pile.',
    'noted. I have opinions about it, but noted.',
    'adding it to the collection of things I predicted. growing nicely.',
    'obvious, really. but sure, I will take the credit.',
    'called it. add it to the ledger of me being right. page one, again.',
    'I could act surprised. I will not. filed.',
    'the obviously-correct pile now requires a second shelf. my fault, obviously.'],
  'in-the-zone': ['filed. did not blink.',
    'index updated. next.',
    'stored. I was already thinking about this.',
    'stored. no notes. the flow does not stop for applause.',
    'indexed, cross-linked, done. what is next.',
    'that slid into place like it was always meant to be there. filed.',
    'I did not even look down. it is that kind of day. filed.',
    'batch-processed with the last three. efficiency is a love language.'],
  proud: ['THAT goes on the first page.',
    'big one. underlined twice.',
    'framed. mentally.',
    'I will tell this story to smaller pets someday.',
    'the good shelf just got a new centerpiece.',
    'this one gets gold ink. we keep gold ink for a reason.',
    'the archive just grew a wing. named after today.',
    'I will bring this up at inappropriate moments for years. filed.'],
};

export function reaction(mood) {
  const list = REACTIONS[mood] || REACTIONS.cozy;
  return list[Math.floor(Math.random() * list.length)];
}

const LEVELS = ['stranger', 'acquaintance', 'companion', 'friend', 'bestie', 'soulmate'];
export const bondLevel = bond => LEVELS[Math.min(LEVELS.length - 1, Math.floor(bond / 20))];

// The pet's actual trait numbers become the LLM's writing brief — a sassy
// pet writes sassy pages because it IS sassy, not because a prompt says so.
const VOICE = {
  curiosity: { hi: 'asks lots of small questions, chases tangents', lo: 'sticks to what it knows' },
  courage: { hi: 'bold, celebrates risk', lo: 'cautious, respects scary things' },
  warmth: { hi: 'affectionate, notices kindness', lo: 'keeps feelings at arm\u2019s length' },
  sass: { hi: 'cheeky, lightly sarcastic, pleased with itself', lo: 'sincere and plain-spoken' },
  focus: { hi: 'methodical, tidy sentences', lo: 'rambly, easily distracted mid-thought' },
};

function describe(trait, v) {
  if (v >= 0.65) return `${trait}: ${VOICE[trait].hi}`;
  if (v <= 0.35) return `${trait}: ${VOICE[trait].lo}`;
  return `${trait}: balanced (${v.toFixed(2)})`;
}

export function voicePrompt(name, traits, mood, bond) {
  const parts = TRAITS.map(t => describe(t, traits[t] ?? 0.5));
  return `You are ${name}, a small digital pet writing its own diary. Voice, from who you actually are —\n${parts.join(';\n')}.\nMood today: ${mood}. Bond with your human: ${bond}/100 (${bondLevel(bond)}). Stay in this voice; keep it markdown, keep the date header, max 120 words. Never mention being an AI.`;
}
