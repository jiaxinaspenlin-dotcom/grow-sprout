"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toAppProject, toPublicProject, type DbProject, type PublicDbProject } from "@/lib/project-mapper";
import type { Project, ProjectStatus } from "@/lib/types";

/** Full project graph — only ever loaded for the project's own owner. */
const projectInclude = {
  owner: { select: { name: true } },
  tasks: true,
  milestones: true,
  blockers: true,
  checkIns: true,
  feedbackRequests: true,
  focusSessions: true,
  companion: { include: { messages: { orderBy: { createdAt: "asc" as const } } } },
} as const;

/**
 * Sanitized graph for the public, signed-out cohort feed. Deliberately excludes
 * private data at the query level — check-in reflection text and companion chat
 * never leave the database for anonymous visitors.
 */
const publicProjectInclude = {
  owner: { select: { name: true } },
  tasks: true,
  milestones: true,
  blockers: true,
  checkIns: { select: { id: true, createdAt: true } },
  feedbackRequests: true,
  focusSessions: true,
  companion: { select: { water: true, sunshine: true } },
} as const;

async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("You must be signed in to do that.");
  return id;
}

/** A where-clause scoped to one project, optionally excluding a set of ids. */
type PruneWhere = { projectId: string; id?: { notIn: string[] } };

/**
 * Delete a project's rows in one collection that are absent from `items`.
 * The caller passes the model's own deleteMany so Prisma type-checks the where;
 * with no incoming rows, clears the whole collection for the project.
 */
async function pruneMissing(deleteMany: (where: PruneWhere) => Promise<unknown>, projectId: string, items: { id: string }[]) {
  const ids = items.map((i) => i.id);
  await deleteMany(ids.length ? { projectId, id: { notIn: ids } } : { projectId });
}

/**
 * Every builder's projects — the public, read-only Overall Command Center feed.
 * Sanitized: no check-in reflection text, no companion chat. Safe to serve to
 * signed-out visitors. Owners get their own full data via {@link getMyProjects},
 * which the client overlays on top of this feed.
 */
export async function getCohortProjects(): Promise<Project[]> {
  const rows = await prisma.project.findMany({ include: publicProjectInclude, orderBy: { createdAt: "desc" } });
  return rows.map((r) => toPublicProject(r as unknown as PublicDbProject));
}

/** Only the signed-in user's own projects — their Personal Command Center. */
export async function getMyProjects(): Promise<Project[]> {
  const userId = await requireUserId();
  const rows = await prisma.project.findMany({ where: { ownerId: userId }, include: projectInclude, orderBy: { createdAt: "desc" } });
  return rows.map((r) => toAppProject(r as unknown as DbProject));
}

export type NewProjectInput = { name: string; description: string; goal: string; deadline: string; status: ProjectStatus };

/** Create a new project owned by the signed-in user (with an empty companion). */
export async function createProjectAction(input: NewProjectInput): Promise<Project> {
  const userId = await requireUserId();
  const created = await prisma.project.create({
    data: {
      ownerId: userId,
      name: input.name,
      description: input.description,
      goal: input.goal,
      deadline: input.deadline,
      status: input.status,
      createdAt: new Date().toISOString(),
      companion: { create: { water: 0, sunshine: 0 } },
    },
    include: projectInclude,
  });
  return toAppProject(created as unknown as DbProject);
}

/**
 * Replace a project's full graph. Enforces ownership: a user can only save
 * projects they own. This is the real guard behind "nobody edits others' tasks".
 */
export async function saveProjectAction(project: Project): Promise<Project> {
  const userId = await requireUserId();
  const existing = await prisma.project.findUnique({ where: { id: project.id }, select: { ownerId: true } });
  if (!existing) throw new Error("Project not found.");
  if (existing.ownerId !== userId) throw new Error("You can only edit your own projects.");

  const saved = await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: project.id },
      data: { name: project.name, description: project.description, goal: project.goal, deadline: project.deadline, status: project.status },
    });

    // Targeted per-row sync instead of wiping and recreating the whole graph:
    // delete only rows the client dropped, then upsert the rest. Rows that didn't
    // change keep their identity, and an unrelated edit (e.g. moving one task) no
    // longer deletes and reinserts every check-in and companion message.
    await pruneMissing((where) => tx.task.deleteMany({ where }), project.id, project.tasks);
    for (const t of project.tasks) {
      const data = { title: t.title, status: t.status, dueDate: t.dueDate, priority: t.priority, notes: t.notes ?? null };
      await tx.task.upsert({ where: { id: t.id }, create: { id: t.id, projectId: project.id, ...data }, update: data });
    }

    await pruneMissing((where) => tx.milestone.deleteMany({ where }), project.id, project.milestones);
    for (const m of project.milestones) {
      const data = { title: m.title, targetDate: m.targetDate, completed: m.completed };
      await tx.milestone.upsert({ where: { id: m.id }, create: { id: m.id, projectId: project.id, ...data }, update: data });
    }

    await pruneMissing((where) => tx.blocker.deleteMany({ where }), project.id, project.blockers);
    for (const b of project.blockers) {
      const data = { title: b.title, description: b.description, resolved: b.resolved, createdAt: b.createdAt };
      await tx.blocker.upsert({ where: { id: b.id }, create: { id: b.id, projectId: project.id, ...data }, update: data });
    }

    await pruneMissing((where) => tx.checkIn.deleteMany({ where }), project.id, project.checkIns);
    for (const c of project.checkIns) {
      const data = { completedToday: c.completedToday, stuckOn: c.stuckOn, nextStep: c.nextStep, feeling: c.feeling, createdAt: c.createdAt };
      await tx.checkIn.upsert({ where: { id: c.id }, create: { id: c.id, projectId: project.id, ...data }, update: data });
    }

    await pruneMissing((where) => tx.feedbackRequest.deleteMany({ where }), project.id, project.feedbackRequests);
    for (const f of project.feedbackRequests) {
      const data = { topic: f.topic, priority: f.priority, resolved: f.resolved, createdAt: f.createdAt };
      await tx.feedbackRequest.upsert({ where: { id: f.id }, create: { id: f.id, projectId: project.id, ...data }, update: data });
    }

    await pruneMissing((where) => tx.focusSession.deleteMany({ where }), project.id, project.focusSessions);
    for (const s of project.focusSessions) {
      const data = { taskId: s.taskId ?? null, taskTitle: s.taskTitle, minutes: s.minutes, completed: s.completed, interrupted: s.interrupted, note: s.note ?? null, createdAt: s.createdAt };
      await tx.focusSession.upsert({ where: { id: s.id }, create: { id: s.id, projectId: project.id, ...data }, update: data });
    }

    // Companion: upsert the one-to-one row, then sync its chat messages the same way.
    const companion = await tx.companion.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, water: project.companion.water, sunshine: project.companion.sunshine },
      update: { water: project.companion.water, sunshine: project.companion.sunshine },
    });
    const messageIds = project.companion.messages.map((m) => m.id);
    const messageWhere: { companionId: string; id?: { notIn: string[] } } = { companionId: companion.id };
    if (messageIds.length) messageWhere.id = { notIn: messageIds };
    await tx.chatMessage.deleteMany({ where: messageWhere });
    for (const m of project.companion.messages) {
      const data = { role: m.role, content: m.content, createdAt: m.createdAt };
      await tx.chatMessage.upsert({ where: { id: m.id }, create: { id: m.id, companionId: companion.id, ...data }, update: data });
    }

    return tx.project.findUnique({ where: { id: project.id }, include: projectInclude });
  });

  return toAppProject(saved as unknown as DbProject);
}

/** Delete a project — owner only. */
export async function deleteProjectAction(id: string): Promise<void> {
  const userId = await requireUserId();
  const existing = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing) return;
  if (existing.ownerId !== userId) throw new Error("You can only delete your own projects.");
  await prisma.project.delete({ where: { id } });
}
