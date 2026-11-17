# Contributing & Staging Workflow

## Core Rules (Non-Negotiable)
1. **Never push directly to `main`.** All changes enter `main` via a Pull Request from a feature branch (`feature-branch` -> `main`).
2. **Never merge `staging` into `main`.** `staging` is strictly a testing environment. Even after a feature passes on `staging`, merge the original `feature-branch` into `main`.

## How to Use `staging`
`staging` is reset to match `main` automatically whenever a PR merges into `main`.

1. **Quick heads-up:** Drop a quick message in team chat before pushing to `staging` so you don't overwrite someone else's active test. *(If two people really need to test small, unrelated changes together, coordinate first—just remember that if `staging` breaks, you'll have to untangle which branch caused it.)*
2. **Ensure a clean slate:** If the previous feature on `staging` was rejected or abandoned, run the **Sync Staging to Main** workflow in the GitHub Actions tab before pushing yours.
3. **Deploy & verify:** Merge your `feature-branch` into `staging` and push. Wait for automated tests and the fake DB reset/seed to finish, then run your manual QA.
4. **Ship or fix:**
   - **Approved:** Merge your `feature-branch` -> `main` PR. (`staging` will auto-sync back to `main` afterward.)
   - **Needs work:** Make fixes on your `feature-branch` (not directly on `staging`), then re-merge into `staging` to re-test.

## Skipping `staging`
Small, low-risk changes—such as documentation updates, copy tweaks, or minor styling fixes—do not need to go through `staging`. Open a PR directly to `main` and merge once automated CI checks pass.

## Notes for AI Agents
- Do not run `git push --force` on `staging` or open PRs from `staging` to `main` unless explicitly asked by the user.
- Always make code edits on a feature branch, never directly on `main` or `staging`.