"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useProjects } from "@/context/project-context";
import { FloatingCompanion } from "./floating-companion";
import { TopBarAuth } from "./top-bar-auth";
import { AlertIcon, CloseIcon } from "./icons";

export function AppShell({ children }: { children: ReactNode }) {
  return <><header className="topbar"><Link href="/" className="brand"><span>Grow Sprout</span></Link><TopBarAuth /></header><StatusBanners /><main>{children}</main><footer>Built for builders who want to keep moving.</footer><FloatingCompanion /></>;
}

/** Cohort-load failures and mutation errors, surfaced instead of failing silently. */
function StatusBanners() {
  const { loadFailed, hydrated, error, clearError, refresh } = useProjects();
  if (!hydrated) return null;
  return (
    <div className="status-banners" aria-live="polite">
      {loadFailed && (
        <div className="status-banner warn" role="alert">
          <AlertIcon /> <span>Couldn&apos;t reach the cohort board. Your data is safe — this is a connection issue.</span>
          <button className="text-button" onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      {error && (
        <div className="status-banner error" role="alert">
          <AlertIcon /> <span>{error}</span>
          <button className="icon-button" onClick={clearError} aria-label="Dismiss"><CloseIcon /></button>
        </div>
      )}
    </div>
  );
}
