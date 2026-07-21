"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useProjects } from "@/context/project-context";
import { cohortStats, momentumLabel } from "@/lib/utils";
import { ProjectForm } from "@/components/project-form";
import { AlertIcon, ArrowIcon, CheckIcon, GitHubIcon, MessageIcon, PlusIcon, TargetIcon, UsersIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { CohortCard, StatCard } from "@/components/project-cards";

/** The Personal Command Center — the signed-in builder's own projects, the only place work is created/edited. */
export default function MyCommandCenter() {
  const { projects, hydrated, myUserId, myName, addProject } = useProjects();
  const [creating, setCreating] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);

  // Whether a reviewer demo login is offered (DEMO_PASSWORD set on the server).
  useEffect(() => {
    let active = true;
    fetch("/api/github/config").then((r) => r.json()).then((d) => { if (active) setDemoEnabled(Boolean(d.demoEnabled)); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const demoSignIn = () => {
    const password = window.prompt("Demo password (for reviewers):");
    if (password) void signIn("demo", { password, redirectTo: "/me" });
  };

  const mine = useMemo(() => projects.filter((p) => p.ownerId === myUserId), [projects, myUserId]);
  const stats = useMemo(() => cohortStats(mine), [mine]);

  if (!hydrated) return <div className="page-container"><div className="dashboard-skeleton"><div /><div /><div /></div></div>;

  // Signed-out gate.
  if (!myUserId) {
    return <div className="page-container">
      <EmptyState
        icon={<GitHubIcon />}
        title="Sign in to open your command center"
        text="Your personal command center is where you plan your projects, track tasks, and keep your momentum visible to the cohort. Sign in with GitHub to get started."
        action={
          <div className="signin-actions">
            <button className="button github-btn" onClick={() => signIn("github")}><GitHubIcon /> Sign in with GitHub</button>
            {demoEnabled && <button className="button secondary" onClick={demoSignIn}>Reviewer? Use the demo account</button>}
          </div>
        }
      />
    </div>;
  }

  return <div className="page-container">
    <section className="hero-row">
      <div>
        <p className="eyebrow">MY COMMAND CENTER</p>
        <h1>{myName ? `${myName.split(" ")[0]}'s projects` : "My projects"}</h1>
        <p>Plan your work here. Everything you add reflects into the cohort&apos;s overall command center.</p>
      </div>
      <button className="button primary large" onClick={() => setCreating(true)}><PlusIcon /> New project</button>
    </section>

    <section className="stat-grid cohort-stats">
      <StatCard icon={<UsersIcon />} tone="purple" label="My projects" value={stats.projects} hint="You own" />
      <StatCard icon={<TargetIcon />} tone="purple" label="Total tasks" value={stats.tasks} hint={`${stats.completed} done`} />
      <StatCard icon={<CheckIcon />} tone="green" label="Completed" value={stats.completed} hint={`${stats.tasks ? Math.round((stats.completed / stats.tasks) * 100) : 0}% of your tasks`} />
      <StatCard icon={<AlertIcon />} tone="red" label="Overdue" value={stats.overdue} hint={stats.overdue ? "Behind schedule" : "All on time"} />
      <StatCard icon={<AlertIcon />} tone="red" label="Open blockers" value={stats.blockers} hint={stats.blockers ? "Ask for help" : "Clear path"} />
      <StatCard icon={<MessageIcon />} tone="amber" label="Needs feedback" value={stats.feedback} hint={stats.feedback ? "Waiting on peers" : "No open requests"} />
    </section>

    {mine.length > 0 && (
      <section className="cohort-momentum">
        <div className="score-ring small" style={{ "--score": `${stats.momentum * 3.6}deg` } as React.CSSProperties}><strong>{stats.momentum}</strong></div>
        <div className="cohort-momentum-copy">
          <span>YOUR MOMENTUM</span>
          <strong>{momentumLabel(stats.momentum)}</strong>
          <p>Averaged across your tasks, blockers, milestones, and check-ins.</p>
        </div>
      </section>
    )}

    <section className="section-heading">
      <div><h2>My projects</h2><p>Only you can edit these. <Link href="/" className="inline-link">See the whole cohort <ArrowIcon /></Link></p></div>
      <span>{mine.length} project{mine.length === 1 ? "" : "s"}</span>
    </section>

    {mine.length ? (
      <section className="project-grid">{mine.map((project) => <CohortCard key={project.id} project={project} />)}</section>
    ) : (
      <EmptyState icon={<TargetIcon />} title="No projects yet" text="Add your first project to kick off your board and appear on the cohort dashboard." action={<button className="button primary" onClick={() => setCreating(true)}><PlusIcon /> New project</button>} />
    )}

    {creating && <ProjectForm onClose={() => setCreating(false)} onSave={addProject} />}
  </div>;
}
