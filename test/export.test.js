import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportHtml, exportBrain, esc, miniMd } from '../src/export.js';
import { initBrain, loadBrain } from '../src/brain.js';
import { writeEpisodic } from '../src/memory.js';
import { writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function brainWithDiary() {
  const dir = mkdtempSync(join(tmpdir(), 'mogwai-export-'));
  initBrain(dir, 'Scrap');
  const brain = loadBrain(dir);
  writeEpisodic(brain, 'learned <script>alert("xss")</script> is a bad habit', { importance: 0.7, tags: [] });
  writeFileSync(join(dir, 'DIARY.md'), '## 2026-10-25 — feeling smug\n\n- did the thing\n\n> quoted wisdom\n');
  return { dir, brain };
}

test('esc neutralizes html/script injection', () => {
  assert.equal(esc('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
  assert.equal(esc('"a" & \'b\''), '&quot;a&quot; &amp; &#39;b&#39;');
});

test('miniMd converts headings, quotes, lists', () => {
  const html = miniMd('## day one\n\n- did a\n- did b\n\n> note\n\nplain line');
  assert.match(html, /<h2>day one<\/h2>/);
  assert.match(html, /<li>did a<\/li>/);
  assert.match(html, /<blockquote>note<\/blockquote>/);
  assert.match(html, /<p>plain line<\/p>/);
});

test('export: self-contained page, pet identity, inert scripts, no external urls', () => {
  const { dir, brain } = brainWithDiary();
  const html = exportHtml(brain);
  assert.match(html, /Scrap/);
  assert.match(html, /&lt;script&gt;alert/); // xss fixture rendered as text
  assert.ok(!/<script>alert/.test(html));
  assert.doesNotMatch(html, /http:\/\//);
  assert.match(html, /traits/);
  assert.match(html, /diary/);
  assert.match(html, /<h2>day one — feeling smug<\/h2>|## 2026-10-25|feeling smug/);
  rmSync(dir, { recursive: true, force: true });
});

test('exportBrain writes a file and reports bytes', () => {
  const { dir, brain } = brainWithDiary();
  const out = join(dir, 'scrap.html');
  const r = exportBrain(brain, out);
  assert.equal(r.path, out);
  assert.equal(r.bytes, statSync(out).size);
  assert.ok(r.bytes > 1000);
  rmSync(dir, { recursive: true, force: true });
});
