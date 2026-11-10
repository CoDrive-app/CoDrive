# How we branch, push, and merge

`main` is the app we showcase and the app we host. It must be the newest version that actually runs. Everything else is a short-lived branch that lands on `main` through a pull request.

Work this way on every change, including docs-only and config-only changes.

## `main`

- `main` is always runnable: `./start.sh` starts the database, API, and app, and the current showcase path works.
- Do not commit or push straight to `main`.
- Do not force-push `main`.
- Do not merge a pull request that leaves `main` unable to start or that breaks the flow you just changed.
- After a merge, `main` is what we demo and what hosting deploys. If it is not ready to show, it does not belong on `main`.

## Branch from `main`

Start every branch from an up-to-date `main`.

```bash
git checkout main
git pull origin main
git checkout -b feature/driver-rotation
```

One branch is one change. A map-tile fix and a new expense field are two branches. If two people need the same area, the open pull request is how you see that before the work overlaps.

Name the branch so the history reads without opening the code:

```text
<type>/<what-it-does>
```

| Type | Use for |
| --- | --- |
| `feature/` | New behavior a user can see or call |
| `fix/` | A bug in something that already shipped |
| `chore/` | Tooling, dependencies, config, refactors with no behavior change |
| `docs/` | Documentation only |

Use lowercase kebab-case after the slash. Examples: `feature/split-expenses`, `fix/trip-delete`, `chore/expo-sdk`, `docs/api-routes`.

The type is the only prefix. Do not add personal names, ticket-only names (`Backend-server`, `ui-setup`), or a branch that keeps growing after its pull request merges.

## Push often

Push the branch the day you create it, then push again after every working slice. A working slice is a commit that builds and moves the change forward, even if the feature is unfinished. Once a day is the minimum while the branch is active. More often is better.

```bash
git push -u origin HEAD
```

Small, frequent pushes keep the remote timeline readable and show everyone what is in progress. An open draft pull request does the same job: open it as soon as the branch exists, and mark it ready when the change runs.

Before you push, update from `main` if `main` has moved:

```bash
git checkout main
git pull origin main
git checkout feature/driver-rotation
git merge main
```

Resolve conflicts on your branch. Leave `main` alone until the pull request is ready.

## Merge through a pull request

When the branch runs, open or mark the pull request ready and merge it into `main`.

Before merge, confirm:

- The branch is up to date with `main`.
- `./start.sh` brings the app up, or you state exactly which step you ran and what you checked.
- The pull request describes what changed and how you checked it.
- The change is the one thing the branch was opened for.

Merge, then delete the branch on GitHub and locally (`git branch -d feature/driver-rotation`). The next task starts from a fresh `main`, not from the old branch.

A fix for something already on `main` uses the same path: `fix/...` from current `main`, push, pull request, merge. Do not patch `main` in place.

## Commits

Write the subject in the imperative, and say why when the diff does not.

```text
Add driver color stretches on the route

Split the line by the hours set on the Trip tab so a demo can show the handoff.
```

Commit when a slice is coherent. Push that commit. Do not stockpile a day of work only on your machine.

## What not to push

Do not commit secrets (`.env`, API keys, credentials). `server/.env` stays local. `server/.env.example` is the file that belongs in git.
