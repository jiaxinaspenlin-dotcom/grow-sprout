"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Project } from "@/lib/types";
import { createProjectAction, deleteProjectAction, getCohortProjects, getMyProjects, saveProjectAction } from "@/lib/actions";

type ProjectContextValue = {
  /** Every builder's projects — the shared cohort view (sanitized for others). */
  projects: Project[];
  hydrated: boolean;
  /** True when the last cohort load failed (vs. a genuinely empty cohort). */
  loadFailed: boolean;
  /** A transient error from the last mutation, for surfacing to the user. */
  error?: string;
  clearError: () => void;
  /** DB id of the signed-in user, or undefined when signed out. Drives edit permissions. */
  myUserId?: string;
  /** Display name of the signed-in user. */
  myName?: string;
  addProject: (project: Project) => Promise<void>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [projects, setProjects] = useState<Project[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    try {
      const cohort = await getCohortProjects();
      // The cohort feed is sanitized (no private check-in text or companion chat).
      // Overlay the signed-in user's own full projects so their board shows
      // everything, while other builders' projects stay redacted.
      let merged = cohort;
      if (userId) {
        const mine = await getMyProjects();
        const mineById = new Map(mine.map((p) => [p.id, p]));
        merged = cohort.map((p) => mineById.get(p.id) ?? p);
      }
      setProjects(merged);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setHydrated(true);
    }
  }, [userId]);

  // Load the cohort feed on mount and whenever the signed-in user changes. The
  // setState happens after the async fetch resolves, not synchronously — the
  // canonical "fetch data in an effect" case.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const clearError = useCallback(() => setError(undefined), []);

  const addProject = useCallback(async (project: Project) => {
    try {
      const created = await createProjectAction({
        name: project.name,
        description: project.description,
        goal: project.goal,
        deadline: project.deadline,
        status: project.status,
      });
      setProjects((current) => [created, ...current]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that project. Please try again.");
      throw e;
    }
  }, []);

  const updateProject = useCallback(async (project: Project) => {
    // Optimistic update, rolled back if the save fails.
    const previous = projects;
    setProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
    try {
      const saved = await saveProjectAction(project);
      setProjects((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (e) {
      setProjects(previous);
      setError(e instanceof Error ? e.message : "Couldn't save your changes. They've been rolled back.");
    }
  }, [projects]);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await deleteProjectAction(id);
      setProjects((current) => current.filter((item) => item.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that project. Please try again.");
      throw e;
    }
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        hydrated,
        loadFailed,
        error,
        clearError,
        myUserId: userId,
        myName: session?.user?.name ?? undefined,
        addProject,
        updateProject,
        deleteProject,
        refresh,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProjects must be used inside ProjectProvider");
  return context;
}
