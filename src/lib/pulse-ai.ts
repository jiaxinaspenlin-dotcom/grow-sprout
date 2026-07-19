import { coercePulse, GitHubPulse, RepoSignals } from "./github";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

/** A concise, safe summary of the repo signals — never raw source or full files. */
function summarize(s: RepoSignals): string {
  return [
    `Repo: ${s.fullName}`,
    `Description: ${s.description ?? "(none)"}`,
    `Primary language: ${s.language ?? "unknown"} · Last pushed: ${s.pushedAt ?? "unknown"}`,
    `README present: ${s.hasReadme ? "yes" : "no"}`,
    s.readme ? `README excerpt:\n${s.readme.slice(0, 1500)}` : "",
    `Recent commits:\n${s.commits.slice(0, 10).map((c) => `- ${c.message.split("\n")[0]} (${c.date.slice(0, 10)})`).join("\n") || "- none"}`,
    `Open issues:\n${s.issues.slice(0, 15).map((i) => `- #${i.number} ${i.title}`).join("\n") || "- none"}`,
    `Open pull requests:\n${s.pullRequests.slice(0, 15).map((p) => `- #${p.number} ${p.title}`).join("\n") || "- none"}`,
    s.packageJson ? `package.json — name: ${s.packageJson.name ?? "?"}, scripts: ${s.packageJson.scripts.join(", ")}, deps: ${s.packageJson.dependencies.slice(0, 20).join(", ")}` : "",
    `Top-level files/folders: ${s.tree.map((t) => t.name).join(", ") || "(none)"}`,
  ].filter(Boolean).join("\n");
}

const SYSTEM = `You are Sprout, a project coach analyzing a GitHub repository for a cohort builder.
Given a concise summary of safe repo signals (never raw source), produce a helpful project pulse.
Respond ONLY with a JSON object of exactly this shape:
{"repoSummary": string, "recentActivity": string, "completedWork": string[], "inProgressWork": string[], "suggestedTasks": [{"title": string, "reason": string, "priority": "Low"|"Medium"|"High", "status": "To Do"|"In Progress"}], "risks": string[], "nextBestAction": string}
Keep every field concise. Infer completed work from recent commits, in-progress work from open PRs, and suggested tasks from open issues and gaps (e.g. missing README). Do not invent facts not supported by the signals.`;

/** Try the local model; return null on any failure so the caller falls back to rules. */
export async function generatePulseWithAI(signals: RepoSignals): Promise<GitHubPulse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        format: "json",
        stream: false,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: summarize(signals) },
        ],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.message?.content;
    if (typeof content !== "string") return null;
    return coercePulse(JSON.parse(content), signals);
  } catch (error) {
    console.error("Pulse AI generation failed, using fallback:", error);
    return null;
  }
}
