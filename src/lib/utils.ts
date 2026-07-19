import { Blocker, CheckIn, CompanionMood, FeedbackRequest, Milestone, Priority, Project, Task } from "./types";

export const uid = () => crypto.randomUUID();

export function dateFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function isOverdue(task: Task) {
  return task.status !== "Done" && new Date(`${task.dueDate}T23:59:59`) < new Date();
}

export function taskProgress(tasks: Task[]) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => task.status === "Done").length / tasks.length) * 100);
}

/** Whole days between an ISO timestamp and now (0 = today). */
export function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Whole days from now until a yyyy-mm-dd date (negative = past). */
export function daysUntil(date: string) {
  return Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86_400_000);
}

/** The most recent check-in for a project, if any. */
export function latestCheckIn(project: Project): CheckIn | undefined {
  return [...project.checkIns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Human "last checked in" label for dashboard indicators. */
export function lastCheckInLabel(project: Project) {
  const latest = latestCheckIn(project);
  if (!latest) return "No check-in yet";
  const days = daysAgo(latest.createdAt);
  if (days <= 0) return "Checked in today";
  if (days === 1) return "Checked in yesterday";
  return `Checked in ${days}d ago`;
}

/** The next open task by soonest due date — the "upcoming task" surfaced on cards. */
export function upcomingTask(project: Project): Task | undefined {
  return project.tasks
    .filter((task) => task.status !== "Done")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
}

export function openBlockers(project: Project) {
  return project.blockers.filter((blocker) => !blocker.resolved);
}

export function openFeedback(project: Project) {
  return project.feedbackRequests.filter((request) => !request.resolved);
}

export type ProjectSignal = "on-track" | "at-risk" | "blocked" | "needs-feedback";

/** Attention signals a project raises, used for dashboard visual cues and filters. */
export function projectSignals(project: Project): ProjectSignal[] {
  const signals: ProjectSignal[] = [];
  if (openBlockers(project).length) signals.push("blocked");
  if (openFeedback(project).length) signals.push("needs-feedback");
  if (project.status === "At Risk" || project.tasks.some(isOverdue)) signals.push("at-risk");
  if (!signals.length && project.status !== "Complete") signals.push("on-track");
  return signals;
}

export function recentFocusSessions(project: Project, days = 7) {
  return project.focusSessions.filter((session) => session.completed && daysAgo(session.createdAt) <= days);
}

export function momentumScore(project: Project) {
  const taskScore = project.tasks.length
    ? (project.tasks.filter((task) => task.status === "Done").length / project.tasks.length) * 35
    : 0;
  const blockerScore = project.blockers.length
    ? (project.blockers.filter((blocker) => blocker.resolved).length / project.blockers.length) * 15
    : 15;
  const milestoneScore = project.milestones.length
    ? (project.milestones.filter((milestone) => milestone.completed).length / project.milestones.length) * 15
    : 0;
  const latest = latestCheckIn(project);
  const days = latest ? daysAgo(latest.createdAt) : Infinity;
  const checkInScore = days <= 1 ? 20 : days <= 3 ? 12 : days <= 7 ? 6 : 0;
  const focusScore = Math.min(recentFocusSessions(project).length * 5, 15);
  const overduePenalty = Math.min(project.tasks.filter(isOverdue).length * 8, 20);
  const feedbackPenalty = Math.min(openFeedback(project).length * 4, 8);

  return Math.max(0, Math.min(100, Math.round(
    taskScore + blockerScore + milestoneScore + checkInScore + focusScore - overduePenalty - feedbackPenalty,
  )));
}

/** The companion's mood is driven by momentum, with open blockers overriding to "Needs help". */
export function companionMood(project: Project): CompanionMood {
  if (openBlockers(project).length) return "Needs help";
  const score = momentumScore(project);
  if (score >= 80) return "Energized";
  if (score >= 50) return "Happy";
  if (score >= 25) return "Concerned";
  return "Tired";
}

export const COMPANION_EMOJI: Record<CompanionMood, string> = {
  Energized: "🚀",
  Happy: "😊",
  Concerned: "🤔",
  Tired: "😴",
  "Needs help": "🆘",
};

/**
 * Plant health (0–100). Sprout dries up when work is overdue or at risk,
 * blockers pile up, or the project goes too long without a check-in.
 */
export function plantHealth(project: Project) {
  let health = 100;
  // Overdue work and an at-risk status each dry Sprout out on their own.
  health -= Math.min(project.tasks.filter(isOverdue).length * 28, 60);
  if (project.status === "At Risk") health -= 28;
  health -= Math.min(openBlockers(project).length * 8, 24);
  const latest = latestCheckIn(project);
  const days = latest ? daysAgo(latest.createdAt) : Infinity;
  if (days > 5) health -= 12;
  return Math.max(0, Math.min(100, Math.round(health)));
}

export type PlantStatus = "Thriving" | "Steady" | "Thirsty" | "Wilting";

export function plantStatus(project: Project): PlantStatus {
  const h = plantHealth(project);
  if (h >= 75) return "Thriving";
  if (h >= 50) return "Steady";
  if (h >= 25) return "Thirsty";
  return "Wilting";
}

export const PLANT_EMOJI: Record<PlantStatus, string> = {
  Thriving: "🌻",
  Steady: "🌱",
  Thirsty: "🥀",
  Wilting: "🍂",
};

/** Water 💧 (nurture) and sunshine ☀️ awarded per rewarding action. */
export const GROWTH_REWARDS = {
  task: { water: 0, sunshine: 3 },
  blocker: { water: 2, sunshine: 3 },
  milestone: { water: 0, sunshine: 8 },
  focus: { water: 4, sunshine: 0 },
  checkIn: { water: 2, sunshine: 0 },
} as const;

export type GrowthReward = { water: number; sunshine: number };

export function momentumLabel(score: number) {
  if (score >= 80) return "Strong momentum";
  if (score >= 50) return "On track";
  if (score >= 25) return "Needs attention";
  return "At risk";
}

export function nextBestAction(project: Project) {
  const priorityRank: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };
  const overdue = project.tasks.filter(isOverdue).sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);
  if (overdue[0]) return `Complete “${overdue[0].title}” — your highest-priority overdue task.`;
  const blocker = project.blockers.find((item) => !item.resolved);
  if (blocker) return `Resolve or ask for help with: “${blocker.description}”`;
  const feedback = openFeedback(project).sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority])[0];
  if (feedback) return `Review the feedback you requested on “${feedback.topic}”.`;
  if (!project.tasks.length) return "Create your first task and turn the goal into a concrete next step.";
  if (project.tasks.every((task) => task.status === "Done")) return "Prepare your demo and document what you learned.";
  if (daysUntil(project.deadline) <= 3 && project.status !== "Complete") return "Deadline is close — focus on the core demo flow and cut the extras.";
  const next = project.tasks.find((task) => task.status === "In Progress") ?? project.tasks.find((task) => task.status === "To Do");
  return next ? `Keep momentum: move “${next.title}” forward.` : "Review your project and choose the next concrete action.";
}

export const statusTone: Record<string, string> = {
  "Not Started": "badge-neutral",
  "In Progress": "badge-blue",
  "At Risk": "badge-red",
  Complete: "badge-green",
  "To Do": "badge-neutral",
  Done: "badge-green",
  Low: "badge-neutral",
  Medium: "badge-amber",
  High: "badge-red",
};

export function aggregateMomentum(projects: Project[]) {
  if (!projects.length) return 0;
  return Math.round(projects.reduce((total, project) => total + momentumScore(project), 0) / projects.length);
}

/** Cohort-wide roll-up used by the shared dashboard. */
export function cohortStats(projects: Project[]) {
  const tasks = projects.flatMap((project) => project.tasks);
  return {
    projects: projects.length,
    tasks: tasks.length,
    completed: tasks.filter((task) => task.status === "Done").length,
    overdue: tasks.filter(isOverdue).length,
    blockers: projects.reduce((total, project) => total + openBlockers(project).length, 0),
    feedback: projects.reduce((total, project) => total + openFeedback(project).length, 0),
    momentum: aggregateMomentum(projects),
  };
}

export type MilestoneInput = Omit<Milestone, "id" | "completed">;
export type BlockerInput = Pick<Blocker, "description">;
export type FeedbackInput = Pick<FeedbackRequest, "topic" | "priority">;
