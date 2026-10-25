# 🐾 mogwai

**A pet for your terminal with a git repo for a brain. Memories decay, personality drifts, and forgetting is reversible.**

```
   /\_/\
  ( o.o )
   > ^ <   ← Gizmo, feeling curious

age: 0 days · memories: 2 (cold: 0) · facts: 1
growth rings: 5 commits · bond: 5/100

curiosity  ███████████░░░░░░░░░  55%
courage    █████████░░░░░░░░░░░  44%
warmth     ██████████░░░░░░░░░░  50%
sass       ██████░░░░░░░░░░░░░░  31%
focus      █████████░░░░░░░░░░░  45%
```

Its diary, written by itself (offline template voice):

```
## 2026-10-25 — feeling curious

- [▓▓▓░░] explored a nasty race condition for hours
- [▓▓▓▓░] shipped tape v0.1 today

> I wonder what tomorrow smells like.
```

## 60-second demo

```bash
npx mogwai-pet init --name Gizmo
npx mogwai-pet feed "shipped v0.1 today"
npx mogwai-pet diary
npx mogwai-pet stats
```

No API key needed. Works on a plane.

## 💬 talk to it, check on it

```
$ mogwai chat "tape"
🐾 that stirs something —
- shipped tape v0.1 today

$ mogwai dream
💭 dreamed: 1 faded memories became "dreamed: replication, postgres, dawn (from 1 faded memory)"

$ mogwai vet
... 
🩺 all good — a healthy brain
```

## The idea

Agent memory in 2026 is either a cloud vector database or an opaque file you'll never read. mogwai takes the opposite bet:

- **The brain is a git repo you can read.** Every memory is a markdown file. Every day of its life is a commit. `git log` is its autobiography; `git revert` is time travel for feelings.
- **Forgetting is Ebbinghaus, not `rm`.** Memories carry importance and decay with `w = importance · e^(−days/14)`. Below weight 0.15 they *hibernate* to `memory/cold/` — a `git mv`, so nothing is ever really gone. `mogwai forget coffee` is deliberate and just as reversible.
- **Personality is grown, not prompted.** Five traits (curiosity, courage, warmth, sass, focus) drift a tiny amount with every event you feed it. Ship something → braver. Explore something → more curious. Nothing declares it sassy; it just slowly gets there. Even sass creeps up +0.005 a day. Life does that.
- **Offline-first, LLM-optional.** The diary has a charming template voice with zero network. Set `MOGWAI_API_KEY` (any OpenAI-compatible endpoint) and it starts writing in its own words.

## Commands

```
mogwai init [--name Gizmo] [--path DIR]   create the brain (a git repo)
mogwai feed "shipped v0.1"                it remembers, and grows a little
mogwai remember "coffee goes in cups"     a fact for the semantic shelf
mogwai forget <word>                      deliberate, reversible forgetting
mogwai diary                              today's page, in its voice
mogwai dream                              faded memories distill into facts
mogwai recall / stats / vet               what it remembers / who it's becoming / health
mogwai pet [--oneline]                    just the pet — put it in your shell prompt
mogwai export [--out FILE]                the brain as a shareable HTML scrapbook
```

The brain lives at `--path`, `$MOGWAI_HOME`, or `~/.local/share/mogwai`. Git commits use a detached identity (`user.name=mogwai`) — your gitconfig is never touched.

### 🐚 in your prompt

```bash
# .zshrc — every command starts with your pet's current mood
PS1='$(mogwai pet --oneline 2>/dev/null)
$ '
```

```
( o.o ) Momo · sprout · curious
$ _
```

## Why not...?

| alternative | the problem |
|---|---|
| chatbot "pets" | no persistence, no memory model, no soul — restart and it's a stranger |
| memory frameworks (mem0, letta, …) | vector DBs, embeddings pipelines, server processes — for a *pet*? |
| OpenClaw plugins | powerful, but your pet's inner life lives in someone else's format |

mogwai's memory model is intentionally simple and **inspectable**: you can `cd` into its head, `grep` its memories, and `diff` yesterday against today.

## MVP scope (v0.1) — deliberately tiny

**In:** episodic memory + decay + hibernation, semantic facts, reversible forgetting, personality drift, moods, offline diary with optional LLM voice, stats.

**Out (on purpose):** chat interface, RAG/embeddings, multi-pet interactions, cron-based autonomous life, a TUI. A pet that needs a vector database has lost the plot.

## Tech stack & why

| choice | reason |
|---|---|
| Node.js ≥ 18, ESM | `npx`-installable; built-in `fetch` for the optional LLM voice |
| **0 runtime dependencies** | the brain should outlive every npm package; `git` + markdown are the storage format |
| markdown + frontmatter | human-readable memories; no database to corrupt |
| git for versioning | free append-only history, free undo, free sync (push the brain anywhere) |

## Roadmap

- ~~v0.2: `mogwai sync`~~ ✅ **shipped** — `mogwai sync --remote <url>` pushes the brain; same pet on every machine.
- v0.3: `mogwai chat` — talk *about* its memories (context assembled from the warm shelf, not embeddings).
- ~~v0.4: personality-consistent LLM voice~~ ✅ **shipped** — trait numbers literally become the diary system prompt (see `voicePrompt`).

## Contributing

Best first PRs: new **reaction lines** (`src/personality.js`), new **pet faces** (`src/render.js`), and translations of the diary templates. All delight, no infrastructure.

MIT © 2026 mogwai contributors
