# Changelog

## Unreleased

- 📼 `mogwai feed --tape` now also eats **OpenClaw / pi** `AgentSession` JSONL (`type:'message'` envelopes, `toolCall` blocks, `toolResult` with `isError` → an error step), so the pet reads the same three dialects tape does. A session with two or more failed tools is still a rough night (importance 0.75, tag `lesson`).

- 🧬 `mogwai breed <other> --name Kid --path DIR` — two brains, one egg: traits are the parents' average plus a deterministic ±0.04 wobble (same parents + same name ⇒ same child), the strongest `--inherit N` memories from each side are carried over with `from:` provenance in the frontmatter and a `> inherited from <name>` line in the body, facts are union-deduped (cap 24), bond resets to 0. `parents.json` records each parent's name, birth, traits and commit hash; `LINEAGE.md` tells the story. Works with a local path or a git URL (cloned to a temp dir, read, discarded). Never overwrites an existing life.
- 🧭 `mogwai family [--depth N]` — the ancestry tree: `← you are here`, both parents with their traits, grandparents when their brains are still on disk, and an `(elsewhere)` marker when a parent's brain has moved on. Founders get a friendly nudge, not an error.
- 📕 `mogwai export` now shows the lineage section for bred pets (and stays silent for founders).
- 🐛 `mogwai --help` alone printed "no brain at…" instead of the help: flags in the command position are now handled.
- 🐛 two memories in the same second overwrote each other (`writeEpisodic` filename collision); the second now gets a `-2` suffix.
- 🧪 55 tests (40 → 55): 15 breeding/lineage/CLI tests.

- 📼 `mogwai feed --tape <session.jsonl>` — the pet eats your coding sessions: one agent session becomes one one-line summary memory (`steps · tools · errors`); rough nights (2+ errors) and ship/fix/deploy words weigh 0.75
- 🥚 growth stages: egg → hatchling → sprout → young → adult → elder (age+bond gates), a distinct ASCII silhouette per stage; `MOGWAI_BIRTH_OVERRIDE` (days) for demos/tests
- 💬 chat continuity: follow-ups ("more", "that", "--") ride the previous recall set; failed lookups never clobber it
- ✍️ 6 new reaction lines (curious/smug/proud)

## Unreleased

- 👁 `mogwai watch` — the pet, alive: full-screen stage art + trait bars + recent diary, breathing every 2s
- 🔩 `mogwai feed -` reads from stdin (pipe-friendly); empty input fails cleanly
- 📖 `mogwai diary --all` explicit full-diary read mode

- 📕 `mogwai export` — the brain as a self-contained single-page HTML scrapbook (zero external URLs, XSS-escaped, mini markdown renderer)

- 🐚 `mogwai pet [--oneline]` — the pet in your shell prompt (PS1 integration)

- 🤝 `mogwai adopt <git-url>` — adopt a shared brain (clone + validate + bond reset)

## 0.1.1 (2026-10-25)

- ✨ `mogwai sync` — push/pull the brain to any git remote (same pet, many machines)
- 💭 `mogwai dream` — faded memories distill into semantic facts (REM for markdown)
- 💬 `mogwai chat` — ask about its memories; keyword recall offline, trait-voiced LLM with a key
- 🩺 `mogwai vet` — brain checkup: git fsck, drift detection, fading-memory forecast; `--json` for cron
- 🎭 personality now steers the LLM diary voice (`voicePrompt`): sassy pets write sassy pages
- ⚙ `MOGWAI_QUIET=1` — cron mode: facts, no flavor
- 🐛 same-day diary reruns rewrite the day's page instead of duplicating it

## 0.1.0

- initial release: episodic memory with Ebbinghaus decay + hibernation, semantic facts, reversible forgetting, personality drift, offline-first diary, zero dependencies
