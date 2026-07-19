"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toAppProject, type DbProject } from "@/lib/project-mapper";
import type { Project, ProjectStatus } from "@/lib/types";

/** Full project graph loaded for the UI. */
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

async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("You must be signed in to do that.");
  return id;
}

/** Every builder's projects — the public, read-only Overall Command Center feed. */
export async function getCohortProjects(): Promise<Project[]> {
  const rows = await prisma.project.findMany({ include: projectInclude, orderBy: { createdAt: "desc" } });
  return rows.map((r) => toAppProject(r as unknown as DbProject));
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

    // Replace each nested collection wholesale to match the client's full-project model.
    await tx.task.deleteMany({ where: { projectId: project.id } });
    await tx.milestone.deleteMany({ where: { projectId: project.id } });
    await tx.blocker.deleteMany({ where: { projectId: project.id } });
    await tx.checkIn.deleteMany({ where: { projectId: project.id } });
    await tx.feedbackRequest.deleteMany({ where: { projectId: project.id } });
    await tx.focusSession.deleteMany({ where: { projectId: project.id } });

    if (project.tasks.length) await tx.task.createMany({ data: project.tasks.map((t) => ({ id: t.id, projectId: project.id, title: t.title, status: t.status, dueDate: t.dueDate, priority: t.priority, notes: t.notes ?? null })) });
    if (project.milestones.length) await tx.milestone.createMany({ data: project.milestones.map((m) => ({ id: m.id, projectId: project.id, title: m.title, targetDate: m.targetDate, completed: m.completed })) });
    if (project.blockers.length) await tx.blocker.createMany({ data: project.blockers.map((b) => ({ id: b.id, projectId: project.id, title: b.title, description: b.description, resolved: b.resolved, createdAt: b.createdAt })) });
    if (project.checkIns.length) await tx.checkIn.createMany({ data: project.checkIns.map((c) => ({ id: c.id, projectId: project.id, completedToday: c.completedToday, stuckOn: c.stuckOn, nextStep: c.nextStep, feeling: c.feeling, createdAt: c.createdAt })) });
    if (project.feedbackRequests.length) await tx.feedbackRequest.createMany({ data: project.feedbackRequests.map((f) => ({ id: f.id, projectId: project.id, topic: f.topic, priority: f.priority, resolved: f.resolved, createdAt: f.createdAt })) });
    if (project.focusSessions.length) await tx.focusSession.createMany({ data: project.focusSessions.map((s) => ({ id: s.id, projectId: project.id, taskId: s.taskId ?? null, taskTitle: s.taskTitle, minutes: s.minutes, completed: s.completed, interrupted: s.interrupted, note: s.note ?? null, createdAt: s.createdAt })) });

    // Companion: upsert the one-to-one row, then replace its chat messages.
    const companion = await tx.companion.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, water: project.companion.water, sunshine: project.companion.sunshine },
      update: { water: project.companion.water, sunshine: project.companion.sunshine },
    });
    await tx.chatMessage.deleteMany({ where: { companionId: companion.id } });
    if (project.companion.messages.length) await tx.chatMessage.createMany({ data: project.companion.messages.map((m) => ({ id: m.id, companionId: companion.id, role: m.role, content: m.content, createdAt: m.createdAt })) });

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
