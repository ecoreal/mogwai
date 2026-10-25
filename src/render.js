// ASCII pet + bars. Faces depend on mood; the pet visibly changes over time.
const FACES = {
  curious:  [' /\\_/\\', '( o.o )', ' > ^ <'],
  fearless: [' /\\_/\\', '( >.< )', ' /\\__/\\'],
  cozy:     [' /\\_/\\', '( ^.^ )', ' > ~ <'],
  smug:     [' /\\_/\\', '( ¬.¬ )', ' > = <'],
  'in-the-zone': [' /\\_/\\', '( -.- )', ' > _ <'],
  sleepy:   [' /\\_/\\', '( -.-)z', ' > z <'],
  proud:    [' /\\_/\\', '( ^o^ )', ' > v <'],
};

export function pet(name, mood) {
  const face = FACES[mood] || FACES.curious;
  return face.map(l => '  ' + l).join('\n') + `   ← ${name}, feeling ${mood}`;
}

export function bar(label, v, width = 20) {
  const filled = Math.round(v * width);
  return `${label.padEnd(10)} ${'█'.repeat(filled)}${'░'.repeat(width - filled)} ${(v * 100).toFixed(0).padStart(3)}%`;
}

export function statsLines(brain, counts, rings) {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(brain.state.birth)) / 864e5));
  const out = [pet(brain.state.name, brain.state.mood || 'curious'), ''];
  out.push(`age: ${days} day${days === 1 ? '' : 's'} · memories: ${counts.episodic} (cold: ${counts.cold}) · facts: ${counts.facts}`);
  out.push(`growth rings: ${rings} commits · bond: ${brain.state.bond}/100`);
  out.push('');
  for (const t of ['curiosity', 'courage', 'warmth', 'sass', 'focus']) {
    out.push(bar(t, brain.traits[t] ?? 0));
  }
  return out;
}
