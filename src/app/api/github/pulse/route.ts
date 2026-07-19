import { NextResponse, type NextRequest } from "next/server";
import { getGithubToken } from "@/lib/github-token";
import { fallbackPulse, isSensitivePath, RepoSignals } from "@/lib/github";
import { generatePulseWithAI } from "@/lib/pulse-ai";

export const runtime = "nodejs";

const NAME = /^[\w.-]+$/;

async function gh<T>(token: string, path: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    const data = res.ok ? ((await res.json()) as T) : null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

const decodeContent = (content?: string, encoding?: string) =>
  content && encoding === "base64" ? Buffer.from(content, "base64").toString("utf8") : "";

export async function POST(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "Not signed in to GitHub." }, { status: 401 });

  let body: { owner?: string; repo?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { owner, repo } = body;
  if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo)) {
    return NextResponse.json({ error: "Invalid repository." }, { status: 400 });
  }
  const base = `/repos/${owner}/${repo}`;

  // Verify the repo exists / is accessible before fetching signals.
  const meta = await gh<{ name: string; full_name: string; description: string | null; html_url: string; default_branch: string; pushed_at: string | null; language: string | null }>(token, base);
  if (!meta.ok || !meta.data) {
    return NextResponse.json({ error: meta.status === 404 ? "Repository not found or not accessible with your permissions." : `GitHub error (${meta.status}).` }, { status: 502 });
  }

  // Fetch only safe, limited signals — no full source, no sensitive files.
  const [readmeR, commitsR, issuesR, pullsR, pkgR, treeR] = await Promise.all([
    gh<{ content?: string; encoding?: string }>(token, `${base}/readme`),
    gh<{ commit: { message: string; author: { date: string; name: string } } }[]>(token, `${base}/commits?per_page=10`),
    gh<{ number: number; title: string; pull_request?: unknown }[]>(token, `${base}/issues?state=open&per_page=20`),
    gh<{ number: number; title: string }[]>(token, `${base}/pulls?state=open&per_page=20`),
    gh<{ content?: string; encoding?: string }>(token, `${base}/contents/package.json`),
    gh<{ name: string; type: string }[]>(token, `${base}/contents`),
  ]);

  const readme = readmeR.ok && readmeR.data ? decodeContent(readmeR.data.content, readmeR.data.encoding).slice(0, 6000) : null;

  let packageJson: RepoSignals["packageJson"] = null;
  if (pkgR.ok && pkgR.data) {
    try {
      const parsed = JSON.parse(decodeContent(pkgR.data.content, pkgR.data.encoding));
      packageJson = {
        name: typeof parsed.name === "string" ? parsed.name : undefined,
        scripts: parsed.scripts && typeof parsed.scripts === "object" ? Object.keys(parsed.scripts).slice(0, 20) : [],
        dependencies: [...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})].slice(0, 40),
      };
    } catch { packageJson = null; }
  }

  const signals: RepoSignals = {
    name: meta.data.name,
    fullName: meta.data.full_name,
    description: meta.data.description,
    htmlUrl: meta.data.html_url,
    defaultBranch: meta.data.default_branch,
    pushedAt: meta.data.pushed_at,
    language: meta.data.language,
    hasReadme: readme !== null,
    readme,
    commits: (commitsR.data ?? []).map((c) => ({ message: c.commit.message, date: c.commit.author.date, author: c.commit.author.name })),
    issues: (issuesR.data ?? []).filter((i) => !i.pull_request).map((i) => ({ number: i.number, title: i.title })),
    pullRequests: (pullsR.data ?? []).map((p) => ({ number: p.number, title: p.title })),
    packageJson,
    // Only top-level names, and never anything that looks sensitive.
    tree: (treeR.data ?? []).filter((t) => !isSensitivePath(t.name)).map((t) => ({ name: t.name, type: t.type })).slice(0, 40),
  };

  const ai = await generatePulseWithAI(signals);
  return NextResponse.json({ pulse: ai ?? fallbackPulse(signals), source: ai ? "ai" : "fallback" });
}
