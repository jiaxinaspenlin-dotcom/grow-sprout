"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { GitHubIcon, TargetIcon } from "./icons";

/** Persistent app-wide GitHub auth control in the top bar. */
export function TopBarAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="topbar-auth-loading" aria-hidden />;
  }

  if (status !== "authenticated") {
    return (
      <button className="button github-btn compact" onClick={() => signIn("github")}>
        <GitHubIcon /> Sign in with GitHub
      </button>
    );
  }

  const user = session?.user;
  const label = user?.name ?? "GitHub user";
  const initials = label.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <div className="topbar-account">
      <Link href="/me" className="topbar-nav-link"><TargetIcon /> My command center</Link>
      {user?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="topbar-avatar" src={user.image} alt="" width={28} height={28} />
      ) : (
        <span className="topbar-avatar fallback">{initials}</span>
      )}
      <span className="topbar-account-name">{label}</span>
      <button className="text-button" onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
