# Contributing to mogwai

Small, sharp tool — same rules apply. Thanks for helping!

## Development setup

```bash
git clone https://github.com/ecoreal/mogwai && cd mogwai
npm test          # node:test, offline
```

Node ≥ 18.17, **zero dependencies** — stdlib only. If a feature needs a
package, it belongs in a separate project.

## Modules

brain.js (state) · personality.js (traits/REACTIONS/voice) · render.js (faces) · memory.js (decay) · chat.js/diary.js/dream.js

## Ground rules

- **Personality is earned, not scripted:** traits drift from real events (`drift()`); never hard-code a personality in a prompt.
- **Stays in voice:** new REACTIONS lines must match the existing mood register (filing/shelf metaphor, dry humor).
- **Forgetting is reversible:** memory decay must always keep an undo path (see memory.js).

## Commit style

Short, imperative, emoji-prefixed to match the house style:
`✨ features · 🐛 fixes · 📝 docs · 🔧 CI/build`.

## Filing issues

Include: the exact command, `--json` output where applicable (redact anything
private), Node version, and what you expected vs got.
