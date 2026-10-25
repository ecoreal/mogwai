// Growth: the pet ages by days alive and bond. Pure math — tests don't wait.
// Stage faces live in render.js (FACES_STAGE); this module only decides.
export const STAGES = ['egg', 'hatchling', 'sprout', 'young', 'adult', 'elder'];

export function stageOf(ageDays, bond) {
  if (ageDays >= 30 && bond >= 80) return 'elder';
  if (ageDays >= 14 && bond >= 50) return 'adult';
  if (ageDays >= 7 && bond >= 25) return 'young';
  if (ageDays >= 3 && bond >= 10) return 'sprout';
  if (ageDays >= 1) return 'hatchling';
  return 'egg';
}

export function ageDaysOf(birthIso, now = Date.now()) {
  const b = Date.parse(birthIso);
  if (!Number.isFinite(b)) return 0;
  return Math.max(0, Math.floor((now - b) / 864e5));
}
