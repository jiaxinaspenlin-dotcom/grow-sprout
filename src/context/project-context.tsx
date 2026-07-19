"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Project } from "@/lib/types";
import { createProjectAction, deleteProjectAction, getCohortProjects, saveProjectAction } from "@/lib/actions";

type ProjectContextValue = {
  /** Every builder's projects — the shared cohort view. */
  projects: Project[];
  hydrated: boolean;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setProjects(await getCohortProjects());
    } catch {
      setProjects([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const addProject = useCallback(async (project: Project) => {
    const created = await createProjectAction({
      name: project.name,
      description: project.description,
      goal: project.goal,
      deadline: project.deadline,
      status: project.status,
    });
    setProjects((current) => [created, ...current]);
  }, []);

  const updateProject = useCallback(async (project: Project) => {
    const saved = await saveProjectAction(project);
    setProjects((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await deleteProjectAction(id);
    setProjects((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        hydrated,
        myUserId: session?.user?.id,
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
