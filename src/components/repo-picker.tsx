"use client";

import { useState } from "react";
import { GitHubRepo } from "@/lib/github";
import { formatDate } from "@/lib/utils";

export function RepoPicker({ repos, onSelect }: { repos: GitHubRepo[]; onSelect: (repo: GitHubRepo) => void }) {
  const [query, setQuery] = useState("");
  const filtered = repos.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="repo-picker">
      <input className="repo-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your repositories…" aria-label="Search repositories" />
      {filtered.length === 0 ? (
        <p className="pulse-hint">{repos.length ? "No repositories match your search." : "No repositories found for this account."}</p>
      ) : (
        <div className="repo-list">
          {filtered.map((repo) => (
            <button key={repo.id} className="repo-item" onClick={() => onSelect(repo)}>
              <div className="repo-item-head">
                <strong>{repo.name}</strong>
                {repo.private && <span className="repo-private">Private</span>}
              </div>
              <p>{repo.description || "No description"}</p>
              <span className="repo-meta">{repo.language ?? "—"} · updated {formatDate(repo.updatedAt.slice(0, 10))}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
