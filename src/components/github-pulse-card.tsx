"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { GitHubPulse, GitHubRepo, SuggestedTask } from "@/lib/github";
import { RepoPicker } from "./repo-picker";
import { SuggestedTaskCard } from "./suggested-task-card";
import { AlertIcon, BoltIcon, CheckIcon, GitHubIcon, SparkIcon, TargetIcon } from "./icons";
import { EmptyState } from "./ui";

type Config = { configured: boolean; missing: string[] };

export function GitHubPulseCard({ onAddTask }: { onAddTask: (task: SuggestedTask) => void }) {
  const { data: session, status } = useSession();
  const [config, setConfig] = useState<Config | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [reposError, setReposError] = useState("");
  const [selected, setSelected] = useState<GitHubRepo | null>(null);
  const [pulse, setPulse] = useState<GitHubPulse | null>(null);
  const [source, setSource] = useState<"ai" | "fallback" | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pulseError, setPulseError] = useState("");

  useEffect(() => {
    fetch("/api/github/config").then((r) => r.json()).then(setConfig).catch(() => setConfig({ configured: false, missing: ["config unavailable"] }));
  }, []);

  // Load repos once authenticated. State updates happen in the async continuation.
  useEffect(() => {
    if (status !== "authenticated" || !config?.configured || repos !== null || reposError) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/github/repos");
        const data = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error(data.error ?? "Could not load repositories.");
        setRepos(data.repos);
      } catch (e) {
        if (active) setReposError(e instanceof Error ? e.message : "Could not load repositories.");
      }
    })();
    return () => { active = false; };
  }, [status, config, repos, reposError]);

  const retryRepos = () => { setReposError(""); setRepos(null); };

  const generatePulse = async (repo: GitHubRepo) => {
    setGenerating(true); setPulse(null); setPulseError(""); setSource(null);
    try {
      const res = await fetch("/api/github/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: repo.owner, repo: repo.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate pulse.");
      setPulse(data.pulse); setSource(data.source);
    } catch (e) {
      setPulseError(e instanceof Error ? e.message : "Could not generate pulse.");
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => { setSelected(null); setPulse(null); setPulseError(""); setSource(null); };

  // ---- State 6: not configured ----
  if (config && !config.configured) {
    return (
      <article className="content-card pulse-card">
        <div className="pulse-setup">
          <div className="pulse-setup-head"><GitHubIcon /><strong>GitHub sign-in isn&apos;t configured yet</strong></div>
          <p>Add a GitHub OAuth app and these environment variables to <code>.env.local</code>, then restart the dev server:</p>
          <ul>{config.missing.map((m) => <li key={m}><code>{m}</code></li>)}</ul>
          <p className="pulse-hint">Callback URL for local dev: <code>http://localhost:3000/api/auth/callback/github</code>. See the README for full setup steps.</p>
        </div>
      </article>
    );
  }

  if (!config || status === "loading") {
    return <article className="content-card pulse-card"><p className="pulse-hint">Loading GitHub…</p></article>;
  }

  // ---- State 1: not connected ----
  if (status !== "authenticated") {
    return (
      <article className="content-card pulse-card">
        <EmptyState
          icon={<GitHubIcon />}
          title="Connect GitHub"
          text="Sign in to pull recent activity from one of your repositories and turn it into board tasks. Read-only — Grow Sprout never writes to your repos."
          action={<button className="button github-btn" onClick={() => signIn("github", { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" })}><GitHubIcon /> Sign in with GitHub</button>}
        />
      </article>
    );
  }

  return (
    <article className="content-card pulse-card">
      <div className="pulse-account">
        <span><GitHubIcon /> Connected as <strong>{session?.user?.name ?? "GitHub user"}</strong></span>
        <button className="text-button" onClick={() => signOut()}>Disconnect</button>
      </div>

      {/* ---- State 2: choose a repository ---- */}
      {!selected && (
        reposError ? (
          <div className="pulse-error-row"><AlertIcon /><span>{reposError}</span><button className="button secondary compact" onClick={retryRepos}>Retry</button></div>
        ) : repos === null ? (
          <p className="pulse-hint">Loading your repositories…</p>
        ) : (
          <RepoPicker repos={repos} onSelect={setSelected} />
        )
      )}

      {/* ---- States 3-5: selected repo, generating, generated ---- */}
      {selected && (
        <div className="pulse-selected">
          <div className="selected-repo">
            <div><span className="panel-kicker"><GitHubIcon /> CONNECTED REPO</span><strong>{selected.fullName}</strong>{selected.description && <p>{selected.description}</p>}</div>
            <button className="text-button" onClick={reset}>Change</button>
          </div>

          {!pulse && !generating && !pulseError && (
            <button className="button primary" onClick={() => generatePulse(selected)}><SparkIcon /> Generate Pulse</button>
          )}
          {generating && <p className="pulse-hint pulse-generating"><span className="spinner" /> Generating pulse from recent activity…</p>}
          {pulseError && <div className="pulse-error-row"><AlertIcon /><span>{pulseError}</span><button className="button secondary compact" onClick={() => generatePulse(selected)}>Retry</button></div>}

          {pulse && (
            <div className="pulse-output">
              <div className="pulse-source">{source === "ai" ? "✨ AI-generated" : "📋 Rule-based summary"}</div>
              <p className="pulse-repo-summary">{pulse.repoSummary}</p>
              <div className="pulse-blocks">
                <PulseList icon={<CheckIcon />} tone="green" title="Completed work" items={pulse.completedWork} />
                <PulseList icon={<BoltIcon />} tone="purple" title="Likely in progress" items={pulse.inProgressWork} />
                <PulseList icon={<AlertIcon />} tone="red" title="Risks" items={pulse.risks} />
              </div>
              <div className="pulse-nba"><TargetIcon /><div><span>RECOMMENDED NEXT BEST ACTION</span><p>{pulse.nextBestAction}</p></div></div>

              <div className="detail-section-heading"><div><h3>Suggested tasks</h3><p>Review each one — nothing is added until you approve it.</p></div><button className="text-button" onClick={() => generatePulse(selected)}>Regenerate</button></div>
              {pulse.suggestedTasks.length ? (
                <div className="suggested-grid">{pulse.suggestedTasks.map((task, i) => <SuggestedTaskCard key={`${task.title}-${i}`} task={task} onAdd={onAddTask} />)}</div>
              ) : <p className="pulse-hint">No task suggestions from this repo right now.</p>}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function PulseList({ icon, tone, title, items }: { icon: React.ReactNode; tone: string; title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="pulse-block">
      <div className={`pulse-block-title ${tone}`}>{icon} {title}</div>
      <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </div>
  );
}
