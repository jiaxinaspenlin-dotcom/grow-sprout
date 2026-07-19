# Cohort MomentumBoard — Build Plan

Turning the single-user localStorage board into a real multi-user cohort app.

## Decisions (locked)
- **Database:** Neon Postgres (serverless), used both locally and in prod.
- **ORM:** Prisma + `@auth/prisma-adapter` (persists next-auth v5 users/accounts/sessions).
- **Mutations:** Next.js Server Actions, each gated by a server-side ownership check.
- **GitHub cohort feed:** on-demand fetch with ~10 min per-repo cache (no cron for now).
- **Auth:** existing next-auth v5 GitHub provider, scope widened to read repo activity.

## Two surfaces (core UX model)
The app is NOT one editable board. It is two distinct surfaces:

1. **Overall Command Center (`/`) — public, read-only.**
   One shared aggregate view of all ~65 builders' projects + momentum. No "New
   project", no edit controls, no mutating actions. Viewable signed-out. It only
   ever *reflects* what builders have entered on their own command centers.

2. **Personal Command Center (`/me`) — sign-in required.**
   Shows only the signed-in user's own projects. The ONLY place create/edit/delete
   of projects and tasks happens. Changes flow upward into the Overall board.

Consequence: "nobody edits anyone else's tasks" is automatic — editing only ever
happens on your own personal center; the overall board is read-only by construction.
Task requests are the sole way work crosses between people.

## Permission rule
- **Reads:** everyone (incl. signed-out) can see the Overall board.
- **Writes:** only on your own Personal Command Center; every mutation asserts
  `resource.ownerId === session.user.id`, else 403. The server is the real gate.

## Data model (Prisma)
- `User`, `Account`, `Session` — next-auth adapter tables. `Account` stores each
  user's GitHub access token (server-only) for activity fetches.
- `Project` — `ownerId → User`. One board per builder.
- `Task` — `projectId`, status, `ownerId` (copied for fast permission checks).
- `Blocker`, `CheckIn`, `Companion` — moved off localStorage onto the project.
- `RepoLink` — connects a `Project` to a GitHub repo for the activity feed.
- `TaskRequest` — `fromUserId`, `toUserId`, `title`, `note`,
  `status` (pending|accepted|declined). Accepting creates a Task on the recipient's board.

## GitHub cohort feed
Each builder links repos to their project. Dashboard aggregates recent commits +
open PRs per linked repo, fetched with that user's token, cached ~10 min.

## Task requests
On another builder's project: "Request a task" → pending `TaskRequest` to the owner →
owner sees a top-bar inbox → Accept spawns the task on their board / Decline closes it.

## Sign-in placement
Move from the buried project-detail card to a persistent top-bar control
(Sign in with GitHub / avatar + Disconnect). Unauthenticated users hit a cohort sign-in gate.

## Phases (checkpoint after each)
1. **Infra + auth persistence** — Prisma + Neon, adapter tables, top-bar sign-in,
   GitHub OAuth app + `.env.local`. *Login works, users persist.*
2. **Data migration** — Projects/Tasks/Blockers/CheckIns → Postgres via server actions;
   dashboard + detail page read from DB. *Board is DB-backed.*
3. **Ownership & permissions** — owner-only mutations, read-only view of others' boards.
   *Can't edit a peer's task, server-verified.*
4. **GitHub cohort feed** — RepoLink model, activity fetch, dashboard "who's working on what."
   *Real repo activity on the dashboard.*
5. **Task requests** — model, request button, inbox, accept/decline. *End-to-end request flow.*

## Setup you must do (Phase 1 prerequisites)
1. **Neon:** create a project at neon.tech → copy the connection string →
   add as `DATABASE_URL` in `.env.local`.
2. **GitHub OAuth app:** github.com/settings/developers → New OAuth App →
   Homepage `http://localhost:3002`, callback `http://localhost:3002/api/auth/callback/github` →
   copy Client ID/Secret into `.env.local` as `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
3. **Auth secret:** `npx auth secret` (or any random string) → `AUTH_SECRET` in `.env.local`.
