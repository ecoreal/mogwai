// ASCII pet + bars. Faces depend on mood; the pet visibly changes over time.
// Two variants per mood — which one you get is a coin flip, so the pet does
// not feel like a looping GIF.
import { stageOf } from './growth.js';
const FACES = {
  curious:  [[' /\\_/\\', '( o.o )', ' > ^ <'], [' /\\_/\\', '( o.O )', ' > ? <']],
  fearless: [[' /\\_/\\', '( >.< )', ' /\\__/\\'], [' /\\_/\\', '( >:3 )', ' /\\__/\\']],
  cozy:     [[' /\\_/\\', '( ^.^ )', ' > ~ <'], [' /\\_/\\', '( ^ω^ )', ' > ~ <']],
  smug:     [[' /\\_/\\', '( ¬.¬ )', ' > = <'], [' /\\_/\\', '( ¬‿¬ )', ' > = <']],
  'in-the-zone': [[' /\\_/\\', '( -.- )', ' > _ <'], [' /\\_/\\', '( -_- )', ' > _ <']],
  sleepy:   [[' /\\_/\\', '( -.-)z', ' > z <'], [' /\\_/\\', '( z.z )', ' > z <']],
  proud:    [[' /\\_/\\', '( ^o^ )', ' > v <'], [' /\\_/\\', '( \\o/ )', ' > v <']],
};

// one silhouette per life stage — single-width, distinct shapes
export const FACES_STAGE = {
  egg:      ['   ,,,,   ', '  ( o   )  ', '   \\_/    '],
  hatchling:['  /\\_\\/\\  ', ' ( o.o  )  ', '  > ^ <    '],
  sprout:   ['  /\\_/\\   ', ' ( ^.^ )~  ', '  > | <    '],
  young:    [' /\\_/\\    ', '( o.o )    ', '  > ^ <   /'],
  adult:    [' /\\_/\\    ', '( ^o^ )    ', ' /|   |\\  '],
  elder:    [' /\\_/\\    ', '( -.-)o    ', '  >| |<__/ '],
};

export function petStage(name, stage, mood) {
  const art = (FACES_STAGE[stage] || FACES_STAGE.egg).map(l => '  ' + l);
  return art.join('\n') + `   ← ${name}, ${stage}, feeling ${mood}`;
}

export function pet(name, mood) {
  const variants = FACES[mood] || FACES.curious;
  const face = variants[Math.floor(Math.random() * variants.length)];
  return face.map(l => '  ' + l).join('\n') + `   ← ${name}, feeling ${mood}`;
}

export function bar(label, v, width = 20) {
  const filled = Math.round(v * width);
  return `${label.padEnd(10)} ${'█'.repeat(filled)}${'░'.repeat(width - filled)} ${(v * 100).toFixed(0).padStart(3)}%`;
}

export function statsLines(brain, counts, rings, ageDaysOverride) {
  const days = ageDaysOverride ?? Math.max(0, Math.floor((Date.now() - Date.parse(brain.state.birth)) / 864e5));
  const stage = stageOf(days, brain.state.bond ?? 0);
  const out = [petStage(brain.state.name, stage, brain.state.mood || 'curious'), ''];
  out.push(`stage: ${stage} · age: ${days} day${days === 1 ? '' : 's'} · memories: ${counts.episodic} (cold: ${counts.cold}) · facts: ${counts.facts}`);
  out.push(`growth rings: ${rings} commits · bond: ${brain.state.bond}/100`);
  out.push('');
  for (const t of ['curiosity', 'courage', 'warmth', 'sass', 'focus']) {
    out.push(bar(t, brain.traits[t] ?? 0));
  }
  return out;
}
