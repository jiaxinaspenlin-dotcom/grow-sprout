import type { Metadata } from "next";
import { Space_Grotesk, Figtree, DM_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { ProjectProvider } from "@/context/project-context";
import { AuthSessionProvider } from "@/components/session-provider";
import "./globals.css";

const bodyFont = Figtree({ subsets: ["latin"], variable: "--font-body" });
const headingFont = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" });
const monoFont = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Grow Sprout",
  description: "A shared cohort command center with an AI motivation companion — track projects, momentum, and blockers together.",
  openGraph: {
    title: "Grow Sprout",
    description: "A shared cohort command center with an AI motivation companion — track projects, momentum, and blockers together.",
    siteName: "Grow Sprout",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${bodyFont.variable} ${headingFont.variable} ${monoFont.variable}`}><AuthSessionProvider><ProjectProvider><AppShell>{children}</AppShell></ProjectProvider></AuthSessionProvider></body></html>;
}
