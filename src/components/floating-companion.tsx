"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useProjects } from "@/context/project-context";
import { ChatMessage } from "@/lib/types";
import {
  aggregateMomentum,
  isOverdue,
  momentumLabel,
  openBlockers,
  openFeedback,
  PLANT_EMOJI,
  plantHealth,
  plantStatus,
  uid,
} from "@/lib/utils";
import { ruleBasedReply } from "@/lib/companion";
import { ProgressBar } from "./ui";
import { BoltIcon, CloseIcon, SendIcon } from "./icons";

const QUICK_PROMPTS = ["What should I do next?", "I'm stuck", "Daily check-in"];

export function FloatingCompanion() {
  const pathname = usePathname();
  const { projects, hydrated, updateProject, myUserId } = useProjects();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
  // Sprout only talks to the project's owner; others see a read-only plant.
  const canChat = !!project && !!myUserId && project.ownerId === myUserId;

  const status = project ? plantStatus(project) : "Steady";
  const emoji = project ? PLANT_EMOJI[status] : "🌱";
  const health = project ? plantHealth(project) : 100;
  const wilting = project ? status === "Thirsty" || status === "Wilting" : false;
  const overdue = project ? project.tasks.filter(isOverdue).length : 0;
  const water = project?.companion.water ?? 0;
  const sunshine = project?.companion.sunshine ?? 0;
  const messages = project?.companion.messages ?? [];

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [open, messages.length, loading]);

  if (!hydrated) return null;

  const saveMessages = (next: ChatMessage[]) => {
    if (!project || !canChat) return;
    void updateProject({ ...project, companion: { ...project.companion, messages: next } });
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || !project || !canChat) return;
    setInput("");
    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed, createdAt: new Date().toISOString() };
    const withUser = [...messages, userMsg];
    saveMessages(withUser);
    setLoading(true);

    let reply: string;
    try {
      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: { ...project, companion: { ...project.companion, messages: withUser } }, message: trimmed }),
      });
      const data = await res.json();
      reply = typeof data.reply === "string" && data.reply ? data.reply : ruleBasedReply(project, trimmed);
    } catch {
      reply = ruleBasedReply(project, trimmed);
    }

    saveMessages([...withUser, { id: uid(), role: "companion", content: reply, createdAt: new Date().toISOString() }]);
    setLoading(false);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); send(input); };

  return (
    <>
      {open && (
        <div className="companion-pop" role="dialog" aria-label="Sprout, your project companion">
          <div className="companion-head">
            <span className={`companion-avatar ${wilting ? "wilting" : ""}`}>{emoji}</span>
            <div className="companion-id">
              <strong>Sprout</strong>
              <span>{project ? `${project.name} · ${status}` : "Your cohort companion"}</span>
            </div>
            {project && (
              <div className="growth-badges">
                <span className="growth-chip water" title="Water — from check-ins & focus">💧 {water}</span>
                <span className="growth-chip sun" title="Sunshine — from progress">☀️ {sunshine}</span>
              </div>
            )}
            <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close companion"><CloseIcon /></button>
          </div>

          {project ? (
            <>
              <div className="companion-energy">
                <div><span><BoltIcon /> Plant health</span><strong>{health}</strong></div>
                <ProgressBar value={health} tone={health >= 50 ? "green" : "purple"} />
              </div>
              {wilting && (
                <div className="wilt-note">🥀 Sprout is {status.toLowerCase()}{overdue > 0 ? ` — ${overdue} overdue task${overdue === 1 ? "" : "s"} ${overdue === 1 ? "is" : "are"} drying it out.` : " — get back on track to water it."}</div>
              )}
              <div className="companion-chat" ref={scrollRef}>
                {messages.length === 0 && <div className="companion-bubble companion">Hi! I&apos;m Sprout. Ask me what to do next, tell me what you&apos;re stuck on, or run a check-in.</div>}
                {messages.map((m) => <div key={m.id} className={`companion-bubble ${m.role}`}>{m.content}</div>)}
                {loading && <div className="companion-bubble companion typing"><span /><span /><span /></div>}
              </div>
              {canChat ? (
                <>
                  <div className="companion-quick">
                    {QUICK_PROMPTS.map((p) => <button key={p} type="button" onClick={() => send(p)} disabled={loading}>{p}</button>)}
                  </div>
                  <form className="companion-input" onSubmit={submit}>
                    <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Sprout for help…" maxLength={400} aria-label="Message your companion" />
                    <button type="submit" className="button primary compact" disabled={loading || !input.trim()} aria-label="Send"><SendIcon /></button>
                  </form>
                </>
              ) : (
                <div className="companion-readonly">You&apos;re viewing {project.owner}&apos;s companion — cheer them on in the cohort! 🌱</div>
              )}
            </>
          ) : (
            <CohortSummary />
          )}
        </div>
      )}

      <button className={`companion-fab ${open ? "is-open" : ""} ${wilting ? "wilting" : ""}`} onClick={() => setOpen((v) => !v)} aria-label="Toggle companion">
        <span className={`fab-emoji ${wilting ? "wilting" : ""}`}>{emoji}</span>
        {project ? <span>💧{water} ☀️{sunshine}</span> : <span>Sprout</span>}
      </button>
    </>
  );
}

function CohortSummary() {
  const { projects } = useProjects();
  const momentum = aggregateMomentum(projects);
  const blocked = projects.filter((p) => openBlockers(p).length).length;
  const needsFeedback = projects.filter((p) => openFeedback(p).length).length;

  return (
    <div className="companion-cohort">
      <div className="companion-energy">
        <div><span><BoltIcon /> Cohort momentum</span><strong>{momentum}</strong></div>
        <ProgressBar value={momentum} tone={momentum >= 50 ? "green" : "purple"} />
      </div>
      <p className="companion-cohort-note">The cohort is <strong>{momentumLabel(momentum).toLowerCase()}</strong>.{blocked > 0 && ` ${blocked} project${blocked > 1 ? "s are" : " is"} blocked.`}{needsFeedback > 0 && ` ${needsFeedback} need${needsFeedback > 1 ? "" : "s"} feedback.`}</p>
      <p className="companion-cohort-note">Open a project and I&apos;ll help you plan your next move, break down blockers, and cheer you on. 🌱</p>
      <Link href="/" className="button secondary" onClick={() => {}}>Back to dashboard</Link>
    </div>
  );
}
