// `mogwai export` — the brain becomes a single-page HTML scrapbook.
// Self-contained: inline CSS, zero external URLs, all text escaped.
import { writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { growthRings } from './brain.js';
import { listEpisodic } from './memory.js';
import { stageOf, ageDaysOf } from './growth.js';
import { FACES_STAGE } from './render.js';

export const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// tiny markdown-ish: ## h2, > quote, - list, rest → paragraphs
export function miniMd(text) {
  const out = [];
  let inList = false;
  for (const raw of String(text).split('\n')) {
    const line = raw.trimEnd();
    if (/^- /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`  <li>${esc(line.slice(2))}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    if (/^## /.test(line)) out.push(`<h2>${esc(line.slice(3))}</h2>`);
    else if (/^> /.test(line)) out.push(`<blockquote>${esc(line.slice(2))}</blockquote>`);
    else if (line.trim()) out.push(`<p>${esc(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function bar(v, label) {
  const pct = Math.round((v) * 100);
  return `<div class="trait"><span class="tl">${esc(label)}</span><span class="tb"><span class="tf" style="width:${pct}%"></span></span><span class="tv">${pct}%</span></div>`;
}

export function exportHtml(brain, now = Date.now()) {
  const override = Number(process.env.MOGWAI_BIRTH_OVERRIDE);
  const days = Number.isFinite(override) ? override : ageDaysOf(brain.state.birth, now);
  const stage = stageOf(days, brain.state.bond ?? 0);
  const face = (FACES_STAGE[stage] || FACES_STAGE.egg).join('\n');
  const rings = growthRings(brain.path);
  const warm = listEpisodic(brain);
  const coldDir = join(brain.path, 'memory', 'cold');
  const cold = existsSync(coldDir) ? readdirSync(coldDir).filter(f => f.endsWith('.md')).length : 0;
  const diary = existsSync(join(brain.path, 'DIARY.md')) ? readFileSync(join(brain.path, 'DIARY.md'), 'utf8') : '(no diary yet)';

  const memories = warm.slice(0, 30).map(m => {
    const pct = Math.round(m.importance * 100);
    return `<li><span class="imp" style="width:${pct}%"></span>${esc(m.body.split('\n')[0].slice(0, 90))}</li>`;
  }).join('\n');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(brain.state.name)} — a mogwai</title>
<style>
  body{background:#141416;color:#d8d4c8;font-family:ui-monospace,Menlo,monospace;max-width:640px;margin:2rem auto;padding:0 1rem;line-height:1.5}
  pre{color:#9ad1a5;font-size:14px}
  h1{font-size:1.2rem;margin-bottom:.2rem} .sub{color:#8a867c;margin-bottom:1.5rem}
  h2{font-size:.95rem;color:#c9a86a;border-bottom:1px solid #2a2a2e;padding-bottom:.3rem;margin-top:2rem}
  blockquote{color:#a8a49a;border-left:3px solid #3a3a40;margin-left:0;padding-left:.8rem;font-style:italic}
  ul{list-style:none;padding-left:0} li{padding:.25rem 0;border-bottom:1px dotted #2a2a2e;position:relative;padding-left:4.5rem}
  .imp{position:absolute;left:0;top:.55rem;height:4px;background:#9ad1a5;display:inline-block;max-width:4rem}
  .trait{display:flex;align-items:center;gap:.5rem;margin:.3rem 0}
  .tl{width:7rem;color:#8a867c} .tb{flex:1;background:#2a2a2e;height:8px;border-radius:4px;overflow:hidden}
  .tf{display:block;height:100%;background:#c9a86a} .tv{width:3rem;text-align:right;color:#8a867c}
  footer{margin-top:3rem;color:#5a564e;font-size:.8rem;border-top:1px solid #2a2a2e;padding-top:1rem}
</style></head><body>
<h1>${esc(brain.state.name)}</h1>
<div class="sub">${stage} · ${days} day${days === 1 ? '' : 's'} old · bond ${brain.state.bond}/100 · ${rings} growth rings · ${warm.length} warm memories · ${cold} hibernated</div>
<pre>${esc(face)}</pre>
<h2>traits</h2>
${Object.entries(brain.traits).map(([k, v]) => bar(v, k)).join('\n')}
<h2>diary</h2>
${miniMd(diary)}
<h2>warm memories</h2>
<ul>${memories || '<li><span class="imp" style="width:0"></span>nothing yet</li>'}</ul>
<footer>made with mogwai — a pet with a git repo for a brain · ${new Date(now).toISOString()}</footer>
</body></html>
`;
}

export function exportBrain(brain, outPath) {
  const html = exportHtml(brain);
  writeFileSync(outPath, html);
  return { path: outPath, bytes: Buffer.byteLength(html) };
}
