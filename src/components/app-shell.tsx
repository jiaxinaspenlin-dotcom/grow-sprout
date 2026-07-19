"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { FloatingCompanion } from "./floating-companion";
import { TopBarAuth } from "./top-bar-auth";

export function AppShell({ children }: { children: ReactNode }) {
  return <><header className="topbar"><Link href="/" className="brand"><span>Grow Sprout</span></Link><TopBarAuth /></header><main>{children}</main><footer>Built for builders who want to keep moving.</footer><FloatingCompanion /></>;
}
