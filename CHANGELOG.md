# Changelog

## 0.1.1 (2026-10-25)

- ✨ `mogwai sync` — push/pull the brain to any git remote (same pet, many machines)
- 🩺 `mogwai vet` — brain checkup: git fsck, drift detection, fading-memory forecast; `--json` for cron
- 🎭 personality now steers the LLM diary voice (`voicePrompt`): sassy pets write sassy pages
- ⚙ `MOGWAI_QUIET=1` — cron mode: facts, no flavor
- 🐛 same-day diary reruns rewrite the day's page instead of duplicating it

## 0.1.0

- initial release: episodic memory with Ebbinghaus decay + hibernation, semantic facts, reversible forgetting, personality drift, offline-first diary, zero dependencies
