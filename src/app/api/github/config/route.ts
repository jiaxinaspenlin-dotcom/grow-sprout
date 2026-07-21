import { NextResponse } from "next/server";
import { githubConfigured } from "@/auth";

export const runtime = "nodejs";

/** Reports whether GitHub sign-in is configured, so the UI can show setup steps instead of a broken button. */
export async function GET() {
  const hasSecret = Boolean(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET);
  const missing: string[] = [];
  if (!process.env.GITHUB_CLIENT_ID) missing.push("GITHUB_CLIENT_ID");
  if (!process.env.GITHUB_CLIENT_SECRET) missing.push("GITHUB_CLIENT_SECRET");
  if (!hasSecret) missing.push("AUTH_SECRET (or NEXTAUTH_SECRET)");
  // demoEnabled lets the UI offer a reviewer sign-in when DEMO_PASSWORD is set.
  return NextResponse.json({ configured: githubConfigured && hasSecret, missing, demoEnabled: Boolean(process.env.DEMO_PASSWORD) });
}
