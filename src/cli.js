import { brainPath, initBrain, loadBrain, saveBrain, commit, growthRings, git } from './brain.js';
import { writeEpisodic, sweepDecay, forget, remember, listEpisodic, HIBERNATE_AT } from './memory.js';
import { classify, drift, moodOf, reaction, bondLevel } from './personality.js';
import { writeDiary, readDiary } from './diary.js';
import { statsLines } from './render.js';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const VERSION = '0.1.0';
const QUIET = process.env.MOGWAI_QUIET === '1'; // cron mode: facts, no flavor
const HELP = `🐾 mogwai ${VERSION} — a pet with a git repo for a brain

usage:
  mogwai init [--name Momo] [--path DIR]     create the brain (a git repo)
  mogwai feed "shipped v0.1 today"           it remembers, and grows a little
  mogwai remember "coffee goes in cups"      a fact for the semantic shelf
  mogwai forget <word>                       deliberate forgetting (git mv — reversible)
  mogwai diary                               it writes today's page (offline; LLM optional)
  mogwai stats                               the pet, its traits, its growth rings
  mogwai vet                                 brain checkup: git, drift, fading memories
  mogwai sync [--remote URL] [--pull]        push/pull the brain — it's just git

the brain lives at --path, $MOGWAI_HOME, or ~/.local/share/mogwai
memories decay like Ebbinghaus curves; below weight ${HIBERNATE_AT} they hibernate to memory/cold/
nothing is ever really lost: cd <brain> && git log / git revert`;

const energyRecovery = brain => {
  const hours = (Date.now() - Date.parse(brain.state.lastEvent)) / 36e5;
  return Math.min(100, brain.state.energy + hours * 6);
};

export async function main(argv) {
  const [cmd, ...rest] = argv;
  const flags = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--path') flags.path = rest[++i];
    else if (a === '--name') flags.name = rest[++i];
    else if (a === '--remote') flags.remote = rest[++i];
    else if (a === '--json') flags.json = true;
    else if (a === '-h' || a === '--help') flags.help = true;
    else flags._.push(a);
  }
  const text = flags._.join(' ');
  const path = brainPath(flags.path);
  if (!cmd || flags.help) { console.log(HELP); process.exitCode = cmd ? 0 : 1; return; }

  if (cmd === 'init') {
    const name = flags.name || 'Momo';
    const { existed } = initBrain(path, name);
    console.log(existed
      ? `🐾 ${name} already lives at ${path}`
      : `🐣 ${name} took first breath at ${path}\n   try: mogwai feed "hello world" --path ${path}`);
    return;
  }

  const brain = loadBrain(path);
  if (!brain) {
    console.error(`no brain at ${path} — run: mogwai init --path ${path}`);
    process.exitCode = 1;
    return;
  }

  // every visit: rest up, then let old memories fade
  brain.state.energy = Math.round(energyRecovery(brain));
  const hibernated = sweepDecay(brain);

  if (cmd === 'feed') {
    if (!text) { console.error('feed what? — mogwai feed "shipped v0.1"'); process.exitCode = 1; return; }
    const { importance, tags } = classify(text);
    writeEpisodic(brain, text, { importance, tags });
    brain.traits = drift(brain.traits, text);
    brain.state.feeds += 1;
    brain.state.energy = Math.max(0, brain.state.energy - 8);
    brain.state.bond = Math.min(100, brain.state.bond + 2);
    brain.state.lastEvent = new Date().toISOString();
    const mood = moodOf(brain.state, brain.traits, importance);
    brain.state.mood = mood;
    saveBrain(brain);
    commit(path, `🌱 grew from: ${text.slice(0, 40)}`);
    if (QUIET) console.log(`stored · importance ${importance} · energy ${brain.state.energy} · bond ${brain.state.bond}`);
    else {
      console.log(`🐾 ${reaction(mood)}`);
      if (hibernated.length) console.log(`   ( ${hibernated.length} old memor${hibernated.length === 1 ? 'y fades' : 'ies fade'} to cold storage )`);
    }
    return;
  }

  if (cmd === 'remember') {
    if (!text) { console.error('remember what?'); process.exitCode = 1; return; }
    remember(brain, text);
    brain.state.lastEvent = new Date().toISOString();
    saveBrain(brain);
    commit(path, `📎 learned: ${text.slice(0, 40)}`);
    console.log('📎 filed under "things that are true".');
    return;
  }

  if (cmd === 'forget') {
    if (!text) { console.error('forget what?'); process.exitCode = 1; return; }
    const moved = forget(brain, text);
    if (!moved.length) { console.log('nothing matched — it never knew that.'); return; }
    saveBrain(brain);
    commit(path, `🌫 forgot: ${text.slice(0, 40)} (recoverable)`);
    for (const t of moved) console.log(`🌫 forgotten: ${t}`);
    console.log('   (recoverable: git checkout inside the brain — forgetting is just a move)');
    return;
  }

  if (cmd === 'diary') {
    const page = await writeDiary(brain, hibernated);
    saveBrain(brain);
    console.log(page);
    console.log(`\n📖 appended to DIARY.md · bond ${brain.state.bond}/100 (${bondLevel(brain.state.bond)})`);
    return;
  }

  if (cmd === 'stats') {
    brain.state.mood = moodOf(brain.state, brain.traits);
    const coldDir = join(path, 'memory', 'cold');
    const counts = {
      episodic: listEpisodic(brain).length,
      cold: existsSync(coldDir) ? readdirSync(coldDir).filter(f => f.endsWith('.md')).length : 0,
      facts: (readFileLines(join(path, 'memory', 'semantic.md')) || []).filter(l => l.startsWith('- ')).length,
    };
    saveBrain(brain);
    console.log(statsLines(brain, counts, growthRings(path)).join('\n'));
    return;
  }

  if (cmd === 'recall') {
    const list = listEpisodic(brain);
    if (!list.length) { console.log('(nothing on the warm shelf — feed it something)'); return; }
    for (const m of list.slice(0, 20)) console.log(`  [${'▓'.repeat(Math.round(m.importance * 5)).padEnd(5, '░')}] ${m.body.split('\n')[0].slice(0, 60)}`);
    return;
  }

  if (cmd === 'sync') {
    const remote = flags.remote || null;
    if (remote) {
      const has = git(path, 'remote').out.trim().split('\n').includes('origin');
      const r = has
        ? git(path, 'remote', 'set-url', 'origin', remote)
        : git(path, 'remote', 'add', 'origin', remote);
      if (!r.ok) { console.error('could not set remote:', r.out.trim()); process.exitCode = 1; return; }
      console.log(`🔗 remote origin → ${remote}`);
    }
    const origin = git(path, 'remote', 'get-url', 'origin');
    if (!origin.ok) {
      console.log(`no remote yet. give it one:\n  mogwai sync --remote git@github.com:you/mogwai-brain.git`);
      process.exitCode = 1;
      return;
    }
    git(path, 'branch', '-M', 'main');
    const pull = flags._.includes('--pull');
    if (pull) {
      const p = git(path, 'pull', '--rebase', 'origin', 'main');
      if (!p.ok) { console.error('pull failed:\n' + p.out.trim()); process.exitCode = 1; return; }
      console.log('📥 pulled — new memories in.');
    }
    const push = git(path, 'push', '-u', 'origin', 'main');
    if (!push.ok) {
      console.error('push rejected — the remote brain has commits you lack.\nrun: mogwai sync --pull --path ' + path);
      process.exitCode = 1;
      return;
    }
    console.log(`🧠 pushed ${growthRings(path)} memories' worth of commits to ${origin.out.trim()}`);
    return;
  }

  if (cmd === 'vet') {
    const { vet } = await import('./vet.js');
    if (!existsSync(path)) { console.error(`no brain at ${path}`); process.exitCode = 1; return; }
    const { lines, problems } = vet(path);
    if (flags.json) console.log(JSON.stringify({ ok: problems === 0, problems: problems.length ? lines.filter(l => l.startsWith('✗')) : [], info: lines }));
    else {
      console.log(lines.join('\n'));
      console.log(problems ? `\n🩺 ${problems} issue(s) need attention` : '\n🩺 all good — a healthy brain');
    }
    if (problems) process.exitCode = 1;
    return;
  }

  console.log(HELP);
  process.exitCode = 1;
}

function readFileLines(file) {
  try { return readFileSync(file, 'utf8').split('\n'); } catch { return null; }
}
