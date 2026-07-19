import type { Project } from "./types";

/** Prisma project with its full graph included (see actions.ts `projectInclude`). */
export type DbProject = {
  id: string;
  ownerId: string;
  owner: { name: string | null } | null;
  name: string;
  description: string;
  goal: string;
  deadline: string;
  status: string;
  createdAt: string;
  tasks: { id: string; title: string; status: string; dueDate: string; priority: string; notes: string | null }[];
  milestones: { id: string; title: string; targetDate: string; completed: boolean }[];
  blockers: { id: string; title: string; description: string; resolved: boolean; createdAt: string }[];
  checkIns: { id: string; completedToday: string; stuckOn: string; nextStep: string; feeling: string; createdAt: string }[];
  feedbackRequests: { id: string; topic: string; priority: string; resolved: boolean; createdAt: string }[];
  focusSessions: { id: string; taskId: string | null; taskTitle: string; minutes: number; completed: boolean; interrupted: boolean; note: string | null; createdAt: string }[];
  companion: { water: number; sunshine: number; messages: { id: string; role: string; content: string; createdAt: string }[] } | null;
};

/** Map a DB project graph into the app's plain `Project` shape used across the UI. */
export function toAppProject(p: DbProject): Project {
  return {
    id: p.id,
    name: p.name,
    owner: p.owner?.name ?? "Unknown builder",
    ownerId: p.ownerId,
    description: p.description,
    goal: p.goal,
    deadline: p.deadline,
    status: p.status as Project["status"],
    createdAt: p.createdAt,
    tasks: p.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status as Project["tasks"][number]["status"], dueDate: t.dueDate, priority: t.priority as Project["tasks"][number]["priority"], notes: t.notes ?? undefined })),
    milestones: p.milestones.map((m) => ({ id: m.id, title: m.title, targetDate: m.targetDate, completed: m.completed })),
    blockers: p.blockers.map((b) => ({ id: b.id, title: b.title, description: b.description, resolved: b.resolved, createdAt: b.createdAt })),
    checkIns: p.checkIns.map((c) => ({ id: c.id, completedToday: c.completedToday, stuckOn: c.stuckOn, nextStep: c.nextStep, feeling: c.feeling, createdAt: c.createdAt })),
    feedbackRequests: p.feedbackRequests.map((f) => ({ id: f.id, topic: f.topic, priority: f.priority as Project["feedbackRequests"][number]["priority"], resolved: f.resolved, createdAt: f.createdAt })),
    focusSessions: p.focusSessions.map((s) => ({ id: s.id, taskId: s.taskId ?? undefined, taskTitle: s.taskTitle, minutes: s.minutes, completed: s.completed, interrupted: s.interrupted, note: s.note ?? undefined, createdAt: s.createdAt })),
    companion: p.companion
      ? { water: p.companion.water, sunshine: p.companion.sunshine, messages: p.companion.messages.map((m) => ({ id: m.id, role: m.role as "user" | "companion", content: m.content, createdAt: m.createdAt })) }
      : { water: 0, sunshine: 0, messages: [] },
  };
}
