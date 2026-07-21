"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useProjects } from "@/context/project-context";
import { cohortStats, momentumLabel, projectSignals } from "@/lib/utils";
import { AlertIcon, ArrowIcon, CheckIcon, MessageIcon, TargetIcon, UsersIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { CohortCard, Filter, FILTERS, StatCard } from "@/components/project-cards";

/**
 * The Overall Command Center — a shared, read-only view of every builder's work.
 * No create/edit actions live here; those belong on each builder's /me center.
 */
export default function OverallDashboard() {
  const { projects, hydrated, myUserId, loadFailed } = useProjects();
  const [filter, setFilter] = useState<Filter>("all");

  const stats = useMemo(() => cohortStats(projects), [projects]);
  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: projects.length, "on-track": 0, "at-risk": 0, blocked: 0, "needs-feedback": 0 };
    for (const project of projects) for (const signal of projectSignals(project)) base[signal] += 1;
    return base;
  }, [projects]);

  const visible = useMemo(
    () => (filter === "all" ? projects : projects.filter((project) => projectSignals(project).includes(filter))),
    [projects, filter],
  );

  if (!hydrated) return <div className="page-container"><div className="dashboard-skeleton"><div /><div /><div /></div></div>;

  return <div className="page-container">
    <section className="hero-row">
      <div>
        <p className="eyebrow">COHORT COMMAND CENTER</p>
        <h1>What everyone&apos;s building</h1>
        <p>One shared view of every builder&apos;s project — who&apos;s on track, who&apos;s blocked, and what&apos;s due next.</p>
      </div>
      {myUserId && <Link href="/me" className="button primary large"><TargetIcon /> My command center <ArrowIcon /></Link>}
    </section>

    <section className="stat-grid cohort-stats">
      <StatCard icon={<UsersIcon />} tone="purple" label="Projects" value={stats.projects} hint="In the cohort" />
      <StatCard icon={<TargetIcon />} tone="purple" label="Total tasks" value={stats.tasks} hint={`${stats.completed} done`} />
      <StatCard icon={<CheckIcon />} tone="green" label="Completed" value={stats.completed} hint={`${stats.tasks ? Math.round((stats.completed / stats.tasks) * 100) : 0}% of all tasks`} />
      <StatCard icon={<AlertIcon />} tone="red" label="Overdue" value={stats.overdue} hint={stats.overdue ? "Behind schedule" : "All on time"} />
      <StatCard icon={<AlertIcon />} tone="red" label="Open blockers" value={stats.blockers} hint={stats.blockers ? "Builders need help" : "Nobody blocked"} />
      <StatCard icon={<MessageIcon />} tone="amber" label="Needs feedback" value={stats.feedback} hint={stats.feedback ? "Waiting on peers" : "No open requests"} />
    </section>

    <section className="cohort-momentum">
      <div className="score-ring small" style={{ "--score": `${stats.momentum * 3.6}deg` } as React.CSSProperties}><strong>{stats.momentum}</strong></div>
      <div className="cohort-momentum-copy">
        <span>OVERALL COHORT MOMENTUM</span>
        <strong>{momentumLabel(stats.momentum)}</strong>
        <p>Averaged across every builder&apos;s tasks, blockers, milestones, and check-ins.</p>
      </div>
    </section>

    <section className="section-heading">
      <div><h2>Builder projects</h2><p>Every project in the cohort, at a glance.</p></div>
      <span>{visible.length} shown</span>
    </section>

    <div className="filter-row">
      {FILTERS.map(({ key, label }) => (
        <button key={key} className={`filter-chip ${filter === key ? "active" : ""} chip-${key}`} onClick={() => setFilter(key)}>
          {label}<b>{counts[key]}</b>
        </button>
      ))}
    </div>

    {visible.length ? (
      <section className="project-grid">{visible.map((project) => <CohortCard key={project.id} project={project} />)}</section>
    ) : projects.length ? (
      <EmptyState icon={<CheckIcon />} title="Nothing in this view" text="No projects match this filter right now — a good sign." action={<button className="button secondary" onClick={() => setFilter("all")}>Show all projects</button>} />
    ) : loadFailed ? (
      <EmptyState icon={<AlertIcon />} title="Couldn’t load the cohort board" text="This looks like a connection issue, not an empty cohort. Try again in a moment." />
    ) : (
      <EmptyState icon={<TargetIcon />} title="No projects yet" text="When builders sign in and add their projects, they show up here for the whole cohort." action={myUserId ? <Link href="/me" className="button primary">Go to my command center</Link> : undefined} />
    )}
  </div>;
}
