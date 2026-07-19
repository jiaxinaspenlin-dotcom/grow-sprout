import { NextResponse } from "next/server";
import type { ChatMessage, Project } from "@/lib/types";
import { buildSystemPrompt, ruleBasedReply } from "@/lib/companion";

export const runtime = "nodejs";

type Body = { project: Project; message: string };

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { project, message } = body;
  if (!project || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "A project and a non-empty message are required." }, { status: 400 });
  }

  try {
    // Build a valid history that starts after any leading assistant turn.
    const history = (project.companion?.messages ?? []).slice(-8).map((m: ChatMessage) => ({
      role: m.role === "companion" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
    const messages = [
      { role: "system" as const, content: buildSystemPrompt(project) },
      ...history,
      { role: "user" as const, content: message.trim() },
    ];

    // Local models can be slow to warm up — bail out to the fallback rather than hang.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
    const data = await res.json();
    const reply = typeof data?.message?.content === "string" ? data.message.content.trim() : "";

    return NextResponse.json({ reply: reply || ruleBasedReply(project, message), source: reply ? "ollama" : "fallback" });
  } catch (error) {
    console.error("Companion API error (falling back to rule-based coach):", error);
    // Ollama not running / model not pulled / timeout → never break the demo.
    return NextResponse.json({ reply: ruleBasedReply(project, message), source: "fallback" });
  }
}
