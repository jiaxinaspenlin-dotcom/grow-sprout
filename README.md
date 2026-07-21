# Grow Sprout

Grow Sprout is a **shared cohort project-management platform with an AI motivation companion**, built for the Algorithmacy Summer 2026 cohort. Every builder gets their own project board — milestones, tasks, blockers, deadlines, daily check-ins, feedback requests, focus sessions, a companion plant, and a live momentum score — rolling up into a **cohort command center** where peers and mentors can see who is on track, who is blocked, who needs feedback, and who is losing momentum.

It is deliberately three things at once:

- **Individual project tracking** — each participant manages their own work end to end.
- **Cohort-wide visibility** — one dashboard rolls every project up into a shared view.
- **AI-powered motivation** — a friendly companion (Sprout) coaches each builder, plus a water/sunshine reward system and focus sessions to keep momentum high.

## Why it exists

Cohort builders lose momentum when work is invisible, blockers sit unspoken, and nobody knows what to do next. Grow Sprout makes progress and struggle visible to the whole cohort, and gives every builder a companion that turns "I'm stuck" into a concrete next step — and celebrates the wins along the way.

## The two-surface model

The app is **not** one editable board. It is two distinct surfaces, and this split is what makes permissions simple:

1. **Cohort Command Center (`/`) — public, read-only.**
   One shared aggregate view of every builder's projects and momentum. No create/edit/delete controls. Viewable signed-out. It only ever *reflects* what builders enter on their own boards.

2. **Personal Command Center (`/me`) — sign-in required.**
   Shows only the signed-in user's projects, and is the **only** place create/edit/delete happens. Changes flow upward into the cohort view.

Consequence: "nobody edits anyone else's work" is automatic — editing only ever happens on your own surface, and the cohort board is read-only by construction.

## Core features

**Cohort dashboard (command center)**
- Every builder's project as a card: name, owner, goal, deadline, status, progress %, momentum score, **companion plant status + water/sunshine**, open blockers, **overdue count**, feedback flag, last check-in, and the **next recommended action**.
- Cohort-level stats: total projects, total tasks, completed tasks, overdue tasks, open blockers, projects needing feedback, and overall cohort momentum.
- Visual cues + one-click filters for **on-track / at-risk / blocked / needs-feedback** projects, with a coloured accent per card.

**Individual project board**
- Overview with goal, deadline, status, owner, progress, momentum score, and a context-aware **Next best action**.
- Three-column task board (**To Do / In Progress / Done**) with add / edit / delete / complete, priority, due date, notes — and a one-click **focus** button per task.
- Weekly milestones, blockers (title + details, open/resolved), feedback requests (topic + priority + reviewed state), and daily check-ins (did / stuck / next / **feeling**).

**AI companion — Sprout (core feature)**
- A chat panel on every project page that receives the full project context (goal, deadline, tasks, overdue work, blockers, feedback, latest check-in, momentum, water/sunshine, focus history).
- Helps run check-ins, breaks blockers into small steps, recommends the next best action, encourages wins, and suggests focus sessions.
- Backed by a Next.js API route calling a **local Ollama model** when Ollama is running, with a **rule-based fallback** so the app always works without it.
- Chat history persists to Postgres, so the companion remembers across sessions and devices.
- Never claims to change app data — it tells you which button to press.

**Grow Sprout — water 💧 & sunshine ☀️ reward system**
- Sprout the companion is a little plant that grows on two resources: **💧 water** (nurturing — focus sessions +4, check-ins +2) and **☀️ sunshine** (progress — completing tasks +3, resolving blockers +3/+2 water, hitting milestones +8).
- **Wilting:** a plant-health value (0–100) drops as tasks go overdue, the project is At Risk, blockers pile up, or check-ins lapse. As health falls, Sprout's status goes **Thriving 🌻 → Steady 🌱 → Thirsty 🥀 → Wilting 🍂**, and its avatar visibly droops and dries out on the companion widget and cohort cards.

**Focus sessions**
- Full-screen focus mode: pick a task, choose 15 / 25 / 45 / 60 minutes, start a countdown, toggle a lo-fi visual mode, pause, or end early.
- On completion it asks what you did and whether to move the task to In Progress or Done; ending early asks what got in the way. Sessions are stored per project, water Sprout 💧, and lift momentum.

**GitHub Sign-In + GitHub Pulse**
- Real **Sign in with GitHub** (Auth.js / NextAuth v5, read-only scope) from a persistent top-bar control. Accounts persist in Postgres via the Prisma adapter.
- Pick one of your repositories, then generate a **GitHub Pulse**: repo summary, recent-activity summary, inferred completed work, likely in-progress work, risks, and a recommended next best action.
- **Suggested tasks** (title, reason, priority, status) with an **"Add to board"** button each — nothing is added to your board without your approval.
- Fetches only **safe signals** (repo metadata, README, recent commits, open issues/PRs, `package.json` summary, top-level file tree) and never `.env` / secrets / full source. GitHub access tokens stay **server-side only** — never exposed to the browser. Read-only; Grow Sprout never writes to your repos.

## How to run locally

Requirements: Node.js 20.9+, npm, and a Postgres database (Neon recommended).

```bash
npm install
npx prisma migrate deploy   # create the tables
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

### Required environment variables

The app needs a database and GitHub OAuth to run — there is no localStorage fallback. Create `.env.local` in the project root:

```bash
DATABASE_URL=postgresql://...        # Neon (or any Postgres) connection string
AUTH_SECRET=...                      # npx auth secret, or openssl rand -base64 32
AUTH_URL=http://localhost:3002       # your deployed URL in production
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
# Optional AI (companion + GitHub Pulse) — local Ollama is used by default:
# OLLAMA_URL=http://localhost:11434
# OLLAMA_MODEL=llama3.1:8b
# Optional reviewer login — when set, adds a shared "Demo account" sign-in that
# doesn't require a GitHub identity. Leave unset in a real cohort. See below.
# DEMO_PASSWORD=some-long-shared-secret
```

`.env.local` is gitignored and must never be committed. The Prisma CLI reads it too (via [prisma.config.ts](prisma.config.ts)), so there's one source of truth.

**Setup steps:**

1. **Neon** — create a project at [neon.tech](https://neon.tech), copy the connection string into `DATABASE_URL`. Use the **pooled** string in production.
2. **GitHub OAuth app** — GitHub → Settings → Developer settings → **OAuth Apps** → **New OAuth App**.
   - Homepage URL: `http://localhost:3002`
   - Authorization callback URL: `http://localhost:3002/api/auth/callback/github`
   - For production: `https://YOUR-DOMAIN/api/auth/callback/github`
3. **Auth secret** — `npx auth secret`, or any long random string.

### Reviewer / demo access (optional)

Sign-in is GitHub-OAuth-only by design, which means a reviewer can't test the authenticated write path without their own GitHub identity. Set `DEMO_PASSWORD` to enable a shared **Demo account** login:

- A "Reviewer? Use the demo account" button appears on the sign-in gate (`/me`), and a "Demo account" option appears on `/api/auth/signin`.
- It signs into a single persistent `Demo Builder` user, so create/edit/delete and the task board are all exercisable.
- Leave `DEMO_PASSWORD` unset in a real cohort — it's a review convenience, not an account system.

### Enabling the live AI companion (optional)

Without Ollama running, the companion and GitHub Pulse use a built-in rule-based coach — no setup needed. To use a local LLM:

```bash
ollama pull llama3.1:8b   # one-time; runs locally, no API key
ollama serve              # if it isn't already running
npm run dev
```

The companion talks to Ollama **only server-side** in the API route ([src/app/api/companion/route.ts](src/app/api/companion/route.ts)) — the browser never calls it directly.

### Database changes

```bash
npx prisma migrate dev --name your_change   # after editing schema.prisma
npx prisma studio                           # inspect data
```

### Production check

```bash
npm run lint
npm run build
npm start
```

## Deploying

Deploys to Vercel from this repo. Three things are easy to miss:

1. **Prisma client generation.** The client is generated into `src/generated/prisma`, which is gitignored — so it is not in the repo. The build script runs `prisma generate` before `next build`; don't remove it or the deploy fails to resolve those imports.
2. **Environment variables.** All five vars above must be set in Vercel → Settings → Environment Variables. `AUTH_URL` must be the deployed URL, not localhost, or sign-in redirects break.
3. **GitHub OAuth callback.** Add `https://YOUR-DOMAIN/api/auth/callback/github` to the OAuth app, or sign-in returns `redirect_uri_mismatch`.

Migrations are not run automatically — apply them against the production database with `npx prisma migrate deploy`.

**Ollama does not exist in a serverless environment.** In production the companion and GitHub Pulse always use the rule-based fallback unless you point `OLLAMA_URL` at a publicly reachable model host.

## Architecture

- **Next.js 16 (App Router) + TypeScript + Tailwind v4.** Routes: `/` (cohort dashboard), `/me` (personal command center), `/projects/[id]` (project detail), `POST /api/companion`, and `/api/github/{config,repos,pulse}`.
- **Database:** Neon Postgres via **Prisma 7** with the `@prisma/adapter-pg` driver adapter ([src/lib/prisma.ts](src/lib/prisma.ts)). Schema and migrations live in [prisma/](prisma/).
- **Mutations:** Next.js **Server Actions** in [src/lib/actions.ts](src/lib/actions.ts) — `getCohortProjects`, `getMyProjects`, `createProjectAction`, `saveProjectAction`, `deleteProjectAction`. Every write resolves the session server-side and asserts `resource.ownerId === session.user.id`, throwing otherwise. The server is the real gate; the UI only hides controls.
- **State:** a `ProjectProvider` React context ([src/context/project-context.tsx](src/context/project-context.tsx)) loads projects through those server actions and exposes `addProject` / `updateProject` / `deleteProject` / `refresh`, plus `myUserId` for permission-aware rendering. Everything — boards, cohort roll-up, growth, momentum — derives from that one array, so nothing drifts.
- **Row ↔ domain mapping:** [src/lib/project-mapper.ts](src/lib/project-mapper.ts) converts Prisma rows to the `Project` shape the UI and pure logic already used, keeping the DB swap invisible to the rest of the app.
- **Auth:** Auth.js/NextAuth v5 ([src/auth.ts](src/auth.ts)) with the GitHub provider and `@auth/prisma-adapter`, so users/accounts/sessions persist. Scope is `read:user` (read-only). Tokens are read server-side only ([src/lib/github-token.ts](src/lib/github-token.ts)).
- **Types:** `Project`, `Task`, `Milestone`, `Blocker`, `CheckIn`, `FeedbackRequest`, `FocusSession`, `CompanionState`, `ChatMessage` in [src/lib/types.ts](src/lib/types.ts).
- **Pure logic** (momentum score, next-best-action, companion mood, plant health, growth rewards, cohort stats, dates) lives in [src/lib/utils.ts](src/lib/utils.ts) — free of React, reused on client and server.
- **Companion logic** ([src/lib/companion.ts](src/lib/companion.ts)) builds the system prompt and the rule-based fallback; [src/lib/pulse-ai.ts](src/lib/pulse-ai.ts) does the same for GitHub Pulse; safe-signal fetching and sanitization live in [src/lib/github.ts](src/lib/github.ts).
- **Components:** `AppShell`, `TopBarAuth`, `ProjectForm`, `CohortCard`, `FloatingCompanion`, `FocusMode`, `GitHubPulseCard`, `RepoPicker`, `SuggestedTaskCard`, plus a small UI kit (`Modal`, `Field`, `ProgressBar`, `EmptyState`) in [src/components/ui.tsx](src/components/ui.tsx).

## Motivation / engagement design

The momentum score (0–100) is intentionally simple and transparent so builders can see *why* it moved:

- Completed tasks — up to **35 pts**
- Resolved blockers — up to **15 pts** (no blockers → full credit)
- Completed milestones — up to **15 pts**
- A recent check-in — up to **20 pts** (full within a day, decaying to 0 after a week)
- Recent completed focus sessions — up to **15 pts**
- Overdue tasks — up to **−20 pts**; open feedback needs — up to **−8 pts**

The design goal is *momentum*, not just completion: showing up (checking in), doing focused work, and unblocking are all rewarded, and stale projects visibly lose steam. That single score drives the cohort card cues and the **next-best-action** engine. On top of it sits **Sprout**, a companion plant that makes the state *felt*: nurturing and progress earn 💧 water and ☀️ sunshine so it grows, while overdue/at-risk work dries it out until it visibly wilts — turning "your project is slipping" into "your plant is thirsty," which is far more motivating than a number going down.

## AI companion explanation

Sprout is a project-coach companion pinned to each project page. On each message the client POSTs the project plus recent chat history to `/api/companion`. The route builds a system prompt from a compact project snapshot (goal, deadline, task/blocker/feedback state, latest check-in, momentum, water/sunshine, focus history) and asks a local Ollama model for a short, practical, project-aware reply. If Ollama isn't running — or the call times out — a deterministic rule-based coach answers instead, using the same project state, so the app never breaks. Messages persist to the `ChatMessage` table. The companion is explicitly instructed never to claim it changed app data; it points you to the right button.

## Current status

Built and working:

- **Infra + auth persistence** — Prisma + Neon, adapter tables, top-bar sign-in. Users persist.
- **Data migration** — projects, tasks, milestones, blockers, check-ins, feedback, focus sessions, companion state and chat all in Postgres via server actions. No localStorage anywhere.
- **Ownership & permissions** — owner-only mutations enforced server-side; the cohort board is read-only by construction.

Not built yet:

- **GitHub cohort feed** — no `RepoLink` model; repo activity is per-user GitHub Pulse on the project page, not aggregated across the cohort dashboard.
- **Task requests** — no `TaskRequest` model, inbox, or accept/decline flow.

## Known limitations

- **The deployed companion runs the rule-based coach, not a live LLM.** The companion and GitHub Pulse call a local Ollama model, which does not exist in a serverless environment like Vercel — so in production they use the deterministic, project-aware rule-based fallback unless you point `OLLAMA_URL` at a publicly reachable model host. The fallback is in-character and state-aware, but it is not a large language model. "AI-assisted guidance" on the live deploy means this fallback.
- **Privacy model of the public board:** the cohort feed (`/`) is viewable signed-out, so it is deliberately sanitized server-side — it excludes raw daily check-in reflections and the private companion chat. Only aggregate signals, status, momentum, tasks, blockers, milestones, and feedback flags are exposed. A builder's own full data is overlaid only for that signed-in owner. What the cohort *does* see: your project's status, momentum, open blockers/feedback, and check-in recency (not the text).
- **Concurrency:** saves sync the project graph with targeted per-row upserts (not a full wipe-and-recreate), so an edit no longer churns unrelated rows. But a save still writes the whole project the client holds, so two people editing the *same* project simultaneously is still effectively last-write-wins at the project level. Per-operation server actions would remove this; not yet done.
- Requires a Postgres database and GitHub OAuth to run at all — there is no offline mode. Set `DEMO_PASSWORD` for a reviewer login (see above); otherwise a fresh database shows an empty cohort board with no seed data.
- **GitHub Pulse** reads limited repo metadata only — it does **not** scan the full codebase, does **not** write to GitHub, and requires your approval before any suggested task is added.
- **Private repo access** depends on OAuth permissions: the default `read:user` scope lists public repos; private repos require the broader `repo` scope.
- **No cross-member assignment.** By design (see [docs/COHORT_PLAN.md](docs/COHORT_PLAN.md)), editing only happens on your own board, so tasks have no assignee — the intended mechanism for work crossing between builders is task requests, which is not built yet. The cohort board shows who is blocked, not who should help.
- No real-time updates — the cohort board refreshes on navigation, not via websockets.
- Dates are stored as ISO strings and rendered in the browser's local time.

## Testing

Pure logic (momentum score, plant health, project signals, cohort roll-up) is covered by unit tests in [src/lib/utils.test.ts](src/lib/utils.test.ts):

```bash
npm test
```

## Future improvements

- Cohort GitHub feed: `RepoLink` model, aggregated commits/PRs per builder on the dashboard.
- Task requests between builders, with an inbox and accept/decline.
- Real-time updates so the cohort board changes live.
- Notifications for approaching deadlines, new blockers, and missed check-ins.
- Cohort trends over time: momentum history, streaks, growth leaderboards, and a mentor "who needs help first" view.

## Agent usage summary

This project was built with an AI coding agent. The agent scaffolded the Next.js app and type system, implemented the pure momentum/companion/growth logic, built the cohort dashboard and project detail UI, wrote the companion API route (local Ollama model + rule-based fallback), the focus-session and GitHub Pulse features, then migrated the whole app off localStorage onto Prisma + Neon Postgres with authenticated, ownership-checked server actions. Inside the product, the AI companion (a local Ollama model, e.g. `llama3.1`) is the runtime agent that coaches each builder from live project context.
