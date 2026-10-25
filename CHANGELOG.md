# Changelog

## Unreleased

- 🥚 growth stages: egg → hatchling → sprout → young → adult → elder (age+bond gates), a distinct ASCII silhouette per stage; `MOGWAI_BIRTH_OVERRIDE` (days) for demos/tests
- 💬 chat continuity: follow-ups ("more", "that", "--") ride the previous recall set; failed lookups never clobber it
- ✍️ 6 new reaction lines (curious/smug/proud)

## Unreleased

- 👁 `mogwai watch` — the pet, alive: full-screen stage art + trait bars + recent diary, breathing every 2s
- 🔩 `mogwai feed -` reads from stdin (pipe-friendly); empty input fails cleanly
- 📖 `mogwai diary --all` explicit full-diary read mode

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
