# Agent Instructions

CRITICAL: Before executing ANY `git` or `gh` commands (branching, merging, pushing, opening PRs, or merging PRs), you MUST read `CONTRIBUTING.md` and follow every rule in it.

- NEVER merge a PR directly into `main` unless the user explicitly confirms `staging` QA has passed.
- NEVER resolve merge conflicts on `CONTRIBUTING.md` or `.github/workflows/*` by discarding `main`'s version.
- NEVER merge a PR while status checks (Vercel, CI) are still pending.