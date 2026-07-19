# MomentumBoard

MomentumBoard is a **shared cohort project-management platform with an AI motivation companion**, built for the Algorithmacy Summer 2026 cohort. Every builder gets their own project board — milestones, tasks, blockers, deadlines, daily check-ins, feedback requests, focus sessions, a companion plant, and a live momentum score — nested inside a **cohort command center** where peers and mentors can see who is on track, who is blocked, who needs feedback, and who is losing momentum.

It is deliberately three things at once:

- **Individual project tracking** — each participant manages their own work end to end.
- **Cohort-wide visibility** — one dashboard rolls every project up into a shared view.
- **AI-powered motivation** — a friendly companion (Sprout) coaches each builder, plus a water/sunshine reward system and focus sessions to keep momentum high.

## Why it exists

Cohort builders lose momentum when work is invisible, blockers sit unspoken, and nobody knows what to do next. MomentumBoard makes progress and struggle visible to the whole cohort, and gives every builder a companion that turns "I'm stuck" into a concrete next step — and celebrates the wins along the way.

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
- Backed by a Next.js API route calling a **local Ollama model** when Ollama is running, with a **rule-based fallback** so the demo always works offline.
- Never claims to change app data — it tells you which button to press.

**Grow Sprout — water 💧 & sunshine ☀️ reward system**
- Sprout the companion is a little plant that grows on two resources: **💧 water** (nurturing — focus sessions +4, check-ins +2) and **☀️ sunshine** (progress — completing tasks +3, resolving blockers +3/+2 water, hitting milestones +8).
- **Wilting:** a plant-health value (0–100) drops as tasks go overdue, the project is At Risk, blockers pile up, or check-ins lapse. As health falls, Sprout's status goes **Thriving 🌻 → Steady 🌱 → Thirsty 🥀 → Wilting 🍂**, and its avatar visibly droops and dries out on the companion widget and cohort cards.

**Focus sessions**
- Full-screen focus mode: pick a task, choose 15 / 25 / 45 / 60 minutes, start a countdown, toggle a lo-fi visual mode, pause, or end early.
- On completion it asks what you did and whether to move the task to In Progress or Done; ending early asks what got in the way. Sessions are stored per project, water Sprout 💧, and lift momentum.

**GitHub Sign-In + GitHub Pulse**
- Real **Sign in with GitHub** (Auth.js / NextAuth, read-only scope) on the project page.
- Pick one of your repositories, then generate a **GitHub Pulse**: repo summary, recent-activity summary, inferred completed work, likely in-progress work, risks, and a recommended next best action.
- **Suggested tasks** (title, reason, priority, status) with an **"Add to board"** button each — nothing is added to your board without your approval.
- Fetches only **safe signals** (repo metadata, README, recent commits, open issues/PRs, `package.json` summary, top-level file tree) and never `.env` / secrets / full source. GitHub access tokens stay **server-side only** — never exposed to the browser or `localStorage`. Read-only; MomentumBoard never writes to your repos.

## How to run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Enabling the live AI companion (optional)

Without Ollama running, the companion uses a built-in rule-based coach — no setup needed. To use a local LLM, install [Ollama](https://ollama.com), pull a model, and run the app:

```bash
ollama pull llama3.1:8b   # one-time; runs locally, no API key
ollama serve              # if it isn't already running
npm run dev
```

The companion talks to Ollama **only server-side** in the API route ([src/app/api/companion/route.ts](src/app/api/companion/route.ts)) — the browser never calls it directly. Override the defaults with `OLLAMA_URL` (default `http://localhost:11434`) and `OLLAMA_MODEL` (default `llama3.1:8b`). GitHub Pulse reuses the same local model to generate its summary, and falls back to a rule-based pulse if Ollama isn't running.

### Enabling GitHub Sign-In + GitHub Pulse (optional)

Without GitHub credentials, the project page shows setup instructions instead of a broken button. To enable it:

1. **Create a GitHub OAuth app** — GitHub → Settings → Developer settings → **OAuth Apps** → **New OAuth App**.
   - Application name: `MomentumBoard` (anything).
   - Homepage URL: `http://localhost:3000`
   - **Authorization callback URL** (local dev): `http://localhost:3000/api/auth/callback/github`
   - For production, use: `https://YOUR-DEPLOYED-DOMAIN/api/auth/callback/github`
2. Copy the **Client ID** and generate a **Client secret**.
3. Create `.env.local` in the project root:

   ```bash
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   AUTH_SECRET=run_`npx auth secret`_or_any_long_random_string
   AUTH_URL=http://localhost:3000        # or NEXTAUTH_URL
   # Optional AI (GitHub Pulse + companion) — local Ollama is used by default:
   # OLLAMA_MODEL=llama3.1:8b
   ```

   `AUTH_SECRET` (or `NEXTAUTH_SECRET`) and `AUTH_URL` (or `NEXTAUTH_URL`) are both accepted. Generate a secret with `npx auth secret` or `openssl rand -base64 32`.
4. Restart `npm run dev`, open a project, and click **Sign in with GitHub** in the GitHub Pulse section.

The OAuth scope requested is `read:user` (read-only, no write access). Listing **private** repos requires the broader `repo` scope — see Known limitations.

Production check:

```bash
npm run lint
npm run build
npm start
```

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind v4.** Routes: `/` (cohort dashboard), `/projects/[id]` (project detail), and `POST /api/companion` (the AI companion).
- **State:** a single `ProjectProvider` React context ([src/context/project-context.tsx](src/context/project-context.tsx)) holds all projects and exposes `addProject` / `updateProject` / `deleteProject`. Everything — individual boards, cohort roll-up, growth, momentum — derives from that one array, so nothing drifts.
- **Persistence:** the context hydrates from `localStorage` (seeding six sample projects on first load) and writes back on every change. A `normalizeProjects` pass backfills any missing fields so older saved data never crashes the UI.
- **Types:** `Project`, `Task`, `Milestone`, `Blocker`, `CheckIn`, `FeedbackRequest`, `FocusSession`, and `CompanionState` live in [src/lib/types.ts](src/lib/types.ts).
- **Pure logic** (momentum score, next-best-action, companion mood, plant health, growth rewards, cohort stats, signals, dates) lives in [src/lib/utils.ts](src/lib/utils.ts) — free of React, so it's reused on both the client and the server.
- **Companion logic** ([src/lib/companion.ts](src/lib/companion.ts)) builds the model system prompt from project context and provides the rule-based fallback; the API route ([src/app/api/companion/route.ts](src/app/api/companion/route.ts)) calls a local Ollama model over its HTTP API (no SDK dependency) or falls back.
- **GitHub feature:** Auth.js/NextAuth config in [src/auth.ts](src/auth.ts) (GitHub provider, read-only scope, token kept on the encrypted server-side JWT); API routes under [src/app/api/github/](src/app/api/github/) (`config`, `repos`, `pulse`); safe-signal fetching + sanitization + rule-based fallback in [src/lib/github.ts](src/lib/github.ts); AI pulse generation in [src/lib/pulse-ai.ts](src/lib/pulse-ai.ts).
- **Reusable components:** `CohortCard`, `TaskColumn`, `MilestoneRow`, `BlockerRow`, `FeedbackRow`, `CheckInCard`, `FloatingCompanion`, `FocusMode`, `FocusCard`, `GitHubPulseCard`, `RepoPicker`, `SuggestedTaskCard`, plus a small UI kit (`Modal`, `Field`, `ProgressBar`, `EmptyState`) in [src/components/ui.tsx](src/components/ui.tsx).

## Motivation / engagement design

The momentum score (0–100) is intentionally simple and transparent so builders can see *why* it moved:

- Completed tasks — up to **35 pts**
- Resolved blockers — up to **15 pts** (no blockers → full credit)
- Completed milestones — up to **15 pts**
- A recent check-in — up to **20 pts** (full within a day, decaying to 0 after a week)
- Recent completed focus sessions — up to **15 pts**
- Overdue tasks — up to **−20 pts**; open feedback needs — up to **−8 pts**

The design goal is *momentum*, not just completion: showing up (checking in), doing focused work, and unblocking are all rewarded, and stale projects visibly lose steam. That single score drives the cohort card cues and the **next-best-action** engine. On top of it sits **Sprout**, a companion plant that makes the state *felt*: nurturing and progress earn 💧 water and ☀️ sunshine so it grows, while overdue/at-risk work dries it out until it visibly wilts — turning "your project is slipping" into "your plant is thirsty," which is far more motivating than a number going down. Focus sessions turn "I should work on this" into a timed, companion-cheered block.

## AI companion explanation

Sprout is a project-coach companion pinned to each project page. On each message the client POSTs the project plus recent chat history to `/api/companion`. The route builds a system prompt from a compact project snapshot (goal, deadline, task/blocker/feedback state, latest check-in, momentum, carrots, focus history) and asks a local Ollama model for a short, practical, project-aware reply. If Ollama isn't running — or the call times out — a deterministic rule-based coach answers instead, using the same project state, so the demo never breaks. The companion is explicitly instructed never to claim it changed app data; it points you to the right button (mark done, start a focus session, request feedback).

## Known limitations

- No app-level accounts for the board itself — "owner" is a text field, and any browser sees the same seeded cohort. (GitHub sign-in authenticates you to GitHub only, for Pulse.)
- `localStorage` only for project data: browser-specific, with no cross-device or real-time collaboration.
- The AI companion and GitHub Pulse use a local Ollama model for live responses; otherwise they use the rule-based fallback.
- **GitHub Pulse** reads limited repo metadata only — it does **not** scan the full codebase, does **not** write to GitHub, and requires your approval before any suggested task is added to the board.
- **Private repo access** depends on GitHub OAuth permissions: the default `read:user` scope lists public repos; private repos require the broader `repo` scope.
- AI summary quality depends on the available repo signals (a repo with no README/commits/issues yields a thinner pulse).
- No production database, and dates use the browser's local time.

## Future improvements

- A real backend (Supabase / PostgreSQL) with accounts, so the cohort shares one live board with real-time updates.
- Persisted, threaded feedback and comments; companion memory across sessions.
- Notifications for approaching deadlines, new blockers, and missed check-ins.
- Cohort trends over time: momentum history, streaks, growth leaderboards, and a mentor "who needs help first" view.
- Deeper GitHub Pulse: OAuth, AI-summarized activity written straight into tasks, and auto-linking commits to milestones.

## Agent usage summary

This MVP was built with an AI coding agent. The agent scaffolded the Next.js app and type system, implemented the pure momentum/companion/growth logic, built the cohort dashboard and project detail UI, wrote the companion API route (local Ollama model + rule-based fallback), the focus-session and companion components, and the GitHub Pulse card, then verified the build and ran the app end-to-end. Inside the product, the AI companion (a local Ollama model, e.g. `llama3.1`) is the runtime agent that coaches each builder from live project context.
