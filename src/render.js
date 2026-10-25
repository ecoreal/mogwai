// ASCII pet + bars. Faces depend on mood; the pet visibly changes over time.
import { stageOf } from './growth.js';
const FACES = {
  curious:  [' /\\_/\\', '( o.o )', ' > ^ <'],
  fearless: [' /\\_/\\', '( >.< )', ' /\\__/\\'],
  cozy:     [' /\\_/\\', '( ^.^ )', ' > ~ <'],
  smug:     [' /\\_/\\', '( ¬.¬ )', ' > = <'],
  'in-the-zone': [' /\\_/\\', '( -.- )', ' > _ <'],
  sleepy:   [' /\\_/\\', '( -.-)z', ' > z <'],
  proud:    [' /\\_/\\', '( ^o^ )', ' > v <'],
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
  const face = FACES[mood] || FACES.curious;
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
