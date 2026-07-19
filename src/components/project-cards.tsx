"use client";

import Link from "next/link";
import { Project } from "@/lib/types";
import {
  formatDate,
  isOverdue,
  lastCheckInLabel,
  momentumLabel,
  momentumScore,
  nextBestAction,
  openBlockers,
  openFeedback,
  PLANT_EMOJI,
  plantStatus,
  ProjectSignal,
  projectSignals,
  statusTone,
  taskProgress,
  upcomingTask,
} from "@/lib/utils";
import { AlertIcon, BoltIcon, CalendarIcon, CheckIcon, ClockIcon, MessageIcon, SparkIcon, TargetIcon } from "@/components/icons";
import { ProgressBar } from "@/components/ui";

export type Filter = "all" | ProjectSignal;

export const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All projects" },
  { key: "at-risk", label: "At risk" },
  { key: "blocked", label: "Blocked" },
  { key: "needs-feedback", label: "Needs feedback" },
  { key: "on-track", label: "On track" },
];

/** Most urgent signal drives the card accent colour. */
export function accentSignal(signals: ProjectSignal[]): ProjectSignal | undefined {
  return (["blocked", "at-risk", "needs-feedback", "on-track"] as ProjectSignal[]).find((s) => signals.includes(s));
}

export const initials = (name: string) =>
  name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?";

export function StatCard({ icon, tone, label, value, hint }: { icon: React.ReactNode; tone: "purple" | "green" | "red" | "amber"; label: string; value: number; hint: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></article>;
}

export function CohortCard({ project }: { project: Project }) {
  const progress = taskProgress(project.tasks);
  const score = momentumScore(project);
  const blockers = openBlockers(project).length;
  const feedback = openFeedback(project).length;
  const overdue = project.tasks.filter(isOverdue).length;
  const signals = projectSignals(project);
  const accent = accentSignal(signals);
  const next = upcomingTask(project);
  const status = plantStatus(project);
  const wilting = status === "Thirsty" || status === "Wilting";

  return <Link href={`/projects/${project.id}`} className={`project-card cohort-card accent-${accent ?? "complete"}`}>
    <div className="project-card-top">
      <span className={`badge ${statusTone[project.status]}`}>{project.status}</span>
      <span className="card-mood" title={`Sprout is ${status}`}><span className={wilting ? "wilting" : ""}>{PLANT_EMOJI[status]}</span> 💧{project.companion.water} ☀️{project.companion.sunshine}</span>
    </div>

    <div className="owner-line"><span className="avatar">{initials(project.owner)}</span><span className="owner-name">{project.owner}</span></div>
    <h3>{project.name}</h3>
    <p>{project.goal}</p>

    {signals.length > 0 && (
      <div className="signal-row">
        {blockers > 0 && <span className="signal-tag danger"><AlertIcon /> {blockers} blocker{blockers > 1 ? "s" : ""}</span>}
        {overdue > 0 && <span className="signal-tag warn"><AlertIcon /> {overdue} overdue</span>}
        {feedback > 0 && <span className="signal-tag info"><MessageIcon /> Feedback</span>}
        {accent === "on-track" && !blockers && !feedback && !overdue && <span className="signal-tag ok"><CheckIcon /> On track</span>}
      </div>
    )}

    <div className="project-meta">
      <span><CalendarIcon /> Due {formatDate(project.deadline)}</span>
      {next && <span className="next-task" title={next.title}><TargetIcon /> {next.title}</span>}
    </div>

    <div className="card-progress"><div><span>Progress</span><strong>{progress}%</strong></div><ProgressBar value={progress} tone={project.status === "Complete" ? "green" : "purple"} /></div>

    <div className="card-next"><SparkIcon /> <span>{nextBestAction(project)}</span></div>

    <div className="project-footer">
      <span><BoltIcon /> {score} · {momentumLabel(score)}</span>
      <span className="checkin-chip"><ClockIcon /> {lastCheckInLabel(project)}</span>
    </div>
  </Link>;
}
