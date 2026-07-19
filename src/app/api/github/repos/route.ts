import { NextResponse, type NextRequest } from "next/server";
import { getGithubToken } from "@/lib/github-token";
import type { GitHubRepo } from "@/lib/github";

export const runtime = "nodejs";

type GhRepo = {
  id: number; name: string; full_name: string; description: string | null;
  private: boolean; updated_at: string; language: string | null; html_url: string;
  owner: { login: string };
};

export async function GET(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "Not signed in to GitHub." }, { status: 401 });

  try {
    const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=30&visibility=all", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.status === 401 ? "GitHub session expired — please sign in again." : `GitHub error (${res.status}).` }, { status: 502 });
    }
    const data: GhRepo[] = await res.json();
    const repos: GitHubRepo[] = data.map((r) => ({
      id: r.id, name: r.name, fullName: r.full_name, owner: r.owner.login,
      description: r.description, private: r.private, updatedAt: r.updated_at,
      language: r.language, htmlUrl: r.html_url,
    }));
    return NextResponse.json({ repos });
  } catch {
    return NextResponse.json({ error: "Could not reach GitHub." }, { status: 502 });
  }
}
