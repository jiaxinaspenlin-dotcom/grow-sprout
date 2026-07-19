import { Priority } from "./types";

// ---- Public types (shared client/server) ----

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  private: boolean;
  updatedAt: string;
  language: string | null;
  htmlUrl: string;
}

export interface SuggestedTask {
  title: string;
  reason: string;
  priority: Priority;
  status: "To Do" | "In Progress";
}

export interface GitHubPulse {
  repoSummary: string;
  recentActivity: string;
  completedWork: string[];
  inProgressWork: string[];
  suggestedTasks: SuggestedTask[];
  risks: string[];
  nextBestAction: string;
}

/** The limited, safe signals we fetch from a repo (server-side only). */
export interface RepoSignals {
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  pushedAt: string | null;
  language: string | null;
  hasReadme: boolean;
  readme: string | null;
  commits: { message: string; date: string; author: string }[];
  issues: { number: number; title: string }[];
  pullRequests: { number: number; title: string }[];
  packageJson: { name?: string; scripts: string[]; dependencies: string[] } | null;
  tree: { name: string; type: string }[];
}

// ---- Security: never fetch or forward sensitive files ----

const SENSITIVE = [/\.env/i, /secret/i, /credential/i, /password/i, /\.pem$/i, /\.key$/i, /^id_rsa/i, /token/i, /\.p12$/i, /\.pfx$/i, /keystore/i, /\.crt$/i];

export function isSensitivePath(name: string): boolean {
  return SENSITIVE.some((re) => re.test(name));
}

// ---- Rule-based fallback pulse (used when AI is unavailable) ----

const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : Infinity);

export function fallbackPulse(s: RepoSignals): GitHubPulse {
  const completedWork = s.commits.slice(0, 5).map((c) => c.message.split("\n")[0]);
  const inProgressWork = s.pullRequests.map((p) => `PR #${p.number}: ${p.title}`);

  const suggestedTasks: SuggestedTask[] = s.issues.slice(0, 6).map((i) => ({
    title: i.title,
    reason: `Open GitHub issue #${i.number}`,
    priority: "Medium" as Priority,
    status: "To Do" as const,
  }));
  if (!s.hasReadme) {
    suggestedTasks.unshift({ title: "Write a README", reason: "The repo has no README — document setup and usage.", priority: "Medium", status: "To Do" });
  }
  if (!s.issues.length && !s.commits.length) {
    suggestedTasks.push({ title: "Create a project plan", reason: "No recent commits or open issues — outline milestones and first tasks.", priority: "High", status: "To Do" });
  }

  const risks: string[] = [];
  const stale = daysSince(s.pushedAt);
  if (stale > 14 && stale !== Infinity) risks.push(`No commits in ~${stale} days — momentum may be stalling.`);
  if (!s.hasReadme) risks.push("Missing README makes the project hard for peers and mentors to review.");
  if (s.pullRequests.length >= 3) risks.push(`${s.pullRequests.length} open pull requests — review and merge to avoid drift.`);

  const recentActivity = `${s.commits.length} recent commit${s.commits.length === 1 ? "" : "s"}, ${s.issues.length} open issue${s.issues.length === 1 ? "" : "s"}, ${s.pullRequests.length} open PR${s.pullRequests.length === 1 ? "" : "s"}.`;

  let nextBestAction: string;
  if (s.pullRequests.length) nextBestAction = `Review and merge the oldest open PR to unblock progress.`;
  else if (s.issues.length) nextBestAction = `Turn the top open issue into a board task and start it.`;
  else if (!s.hasReadme) nextBestAction = `Add a README so the cohort can follow your project.`;
  else if (stale > 14) nextBestAction = `Make a small commit to rebuild momentum, then plan the next milestone.`;
  else nextBestAction = `Break the next piece of work into a concrete task and add it to your board.`;

  return {
    repoSummary: `${s.fullName}${s.description ? ` — ${s.description}` : ""}${s.language ? ` (${s.language})` : ""}.`,
    recentActivity,
    completedWork,
    inProgressWork,
    suggestedTasks,
    risks,
    nextBestAction,
  };
}

/** Coerce arbitrary AI JSON into a valid GitHubPulse (defends against malformed model output). */
export function coercePulse(raw: unknown, signals: RepoSignals): GitHubPulse {
  const fb = fallbackPulse(signals);
  if (!raw || typeof raw !== "object") return fb;
  const p = raw as Record<string, unknown>;
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 8) : []);
  const prio = (v: unknown): Priority => (v === "High" || v === "Low" || v === "Medium" ? v : "Medium");
  const stat = (v: unknown): SuggestedTask["status"] => (v === "In Progress" ? "In Progress" : "To Do");
  const tasks: SuggestedTask[] = Array.isArray(p.suggestedTasks)
    ? p.suggestedTasks.filter((t): t is Record<string, unknown> => !!t && typeof t === "object" && typeof (t as Record<string, unknown>).title === "string").slice(0, 8).map((t) => ({
        title: String(t.title).slice(0, 120),
        reason: typeof t.reason === "string" ? t.reason.slice(0, 240) : "Suggested from repo activity.",
        priority: prio(t.priority),
        status: stat(t.status),
      }))
    : fb.suggestedTasks;
  return {
    repoSummary: typeof p.repoSummary === "string" ? p.repoSummary : fb.repoSummary,
    recentActivity: typeof p.recentActivity === "string" ? p.recentActivity : fb.recentActivity,
    completedWork: strArr(p.completedWork).length ? strArr(p.completedWork) : fb.completedWork,
    inProgressWork: strArr(p.inProgressWork),
    suggestedTasks: tasks.length ? tasks : fb.suggestedTasks,
    risks: strArr(p.risks),
    nextBestAction: typeof p.nextBestAction === "string" ? p.nextBestAction : fb.nextBestAction,
  };
}
