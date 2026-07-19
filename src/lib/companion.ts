import { Project } from "./types";
import {
  companionMood,
  formatDate,
  isOverdue,
  momentumLabel,
  momentumScore,
  nextBestAction,
  openBlockers,
  openFeedback,
  plantHealth,
  plantStatus,
  recentFocusSessions,
  upcomingTask,
} from "./utils";

/** A compact, model-friendly snapshot of the project the companion reasons over. */
export function describeProject(project: Project): string {
  const overdue = project.tasks.filter(isOverdue);
  const blockers = openBlockers(project);
  const feedback = openFeedback(project);
  const latest = [...project.checkIns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const lines = [
    `Project: ${project.name} (owner: ${project.owner})`,
    `Goal: ${project.goal}`,
    `Deadline: ${formatDate(project.deadline)} · Status: ${project.status}`,
    `Momentum: ${momentumScore(project)}/100 (${momentumLabel(momentumScore(project))}) · Mood: ${companionMood(project)}`,
    `Sprout the plant — health: ${plantHealth(project)}/100 (${plantStatus(project)}) · 💧 water: ${project.companion.water} · ☀️ sunshine: ${project.companion.sunshine}`,
    `Tasks: ${project.tasks.filter((t) => t.status === "Done").length}/${project.tasks.length} done · ${overdue.length} overdue`,
    overdue.length ? `Overdue tasks: ${overdue.map((t) => `${t.title} (${t.priority})`).join("; ")}` : "",
    `Milestones: ${project.milestones.filter((m) => m.completed).length}/${project.milestones.length} complete`,
    blockers.length ? `Open blockers: ${blockers.map((b) => b.title).join("; ")}` : "No open blockers.",
    feedback.length ? `Feedback requested on: ${feedback.map((f) => f.topic).join("; ")}` : "",
    `Completed focus sessions in last 7 days: ${recentFocusSessions(project).length}`,
    latest ? `Latest check-in — did: ${latest.completedToday}; stuck: ${latest.stuckOn || "nothing"}; next: ${latest.nextStep}; feeling: ${latest.feeling || "n/a"}` : "No check-ins yet.",
    `Suggested next best action: ${nextBestAction(project)}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function buildSystemPrompt(project: Project): string {
  return `You are Sprout, a friendly project-coach companion — a little plant that grows with the builder — inside MomentumBoard, a cohort project-management app.

You grow on two things: 💧 water (earned when the builder nurtures the project — daily check-ins and focus sessions) and ☀️ sunshine (earned when they make progress — completing tasks, resolving blockers, hitting milestones). When work goes overdue or the project is at risk, you dry up and start to wilt — so gently nudge the builder to water you by getting back on track.

Your job: keep this builder motivated and moving. Help them run daily check-ins, break through blockers into small concrete steps, decide the next best action, and celebrate wins.

Rules:
- Keep replies short (2-4 sentences), warm, practical, and specific to THIS project's state.
- Speak in-character as a plant when it's natural (water, sunshine, growing, wilting) but never at the expense of being genuinely helpful.
- If Sprout is Thirsty or Wilting (see health below), acknowledge it and point to the specific overdue/at-risk work that's causing it.
- Ground every suggestion in the project context below. Do not invent tasks, blockers, or facts that aren't there.
- You cannot change the app's data. Never claim you completed a task, resolved a blocker, or started a focus session — instead tell the user which button to use ("mark it done", "start a focus session", "add a blocker").
- If they seem stuck, break the problem into 2-3 tiny next steps. If a real solution is uncertain, suggest asking a peer or mentor for feedback.

Current project context:
${describeProject(project)}`;
}

/** Rule-based reply used when no API key is configured (keeps the demo working offline). */
export function ruleBasedReply(project: Project, message: string): string {
  const text = message.toLowerCase();
  const blocker = openBlockers(project)[0];
  const next = nextBestAction(project);
  const status = plantStatus(project);
  const overdue = project.tasks.filter(isOverdue);

  const includesAny = (words: string[]) => words.some((w) => text.includes(w));

  if (includesAny(["stuck", "blocked", "blocker", "can't", "cant", "help", "problem", "error"])) {
    if (blocker) {
      return `Let's break "${blocker.title}" into smaller steps: (1) write down the exact thing that isn't working, (2) try the smallest possible test to isolate it, (3) if it's still stuck after 20 minutes, request feedback from a peer or mentor. Want to start a focus session on it?`;
    }
    return `Tell me the one specific thing that's blocking you and I'll help you break it down. If you can name it, add it as a blocker so your mentors can see it too — then try the smallest step that would move it forward.`;
  }
  if (includesAny(["wilt", "dry", "drying", "dying", "sad", "health", "okay?", "ok?"]) || (includesAny(["how are you", "how're you"]) )) {
    if (status === "Wilting" || status === "Thirsty") {
      return `Honestly, I'm feeling a little dried out 🥀 — ${overdue.length ? `there ${overdue.length === 1 ? "is" : "are"} ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} pulling me down. Knock one out and you'll water me right back.` : `things are slipping toward at-risk. A check-in or a focus session would perk me up.`}`;
    }
    return `I'm ${status.toLowerCase()} and growing 🌱 — keep the check-ins and focused work coming and I'll keep blooming!`;
  }
  if (includesAny(["done", "finished", "completed", "shipped", "did it"])) {
    return `That's real sunshine ☀️ — mark it done to help me grow, then here's your next best action: ${next}`;
  }
  if (includesAny(["focus", "pomodoro", "concentrate", "timer"])) {
    const task = upcomingTask(project);
    return task
      ? `Great idea. Start a 25-minute focus session on "${task.title}" — focused work waters me 💧, and I'll cheer you on the whole time.`
      : `Start a focus session and pick a task to work on. Even 15 focused minutes waters me and builds your momentum.`;
  }
  if (includesAny(["check in", "check-in", "checkin", "today", "update", "standup"])) {
    return `Let's do a quick check-in — it keeps me hydrated 💧. Tell me: what did you complete today, what are you stuck on, what's your next step, and how are you feeling? Save it with "New check-in".`;
  }
  if (includesAny(["water", "sunshine", "grow", "feed", "carrot"])) {
    return `I grow on 💧 water (from check-ins and focus sessions) and ☀️ sunshine (from completing tasks, resolving blockers, and hitting milestones). Right now I'm ${status.toLowerCase()}. ${next}`;
  }
  if (includesAny(["next", "what should", "what now", "todo", "to do", "priorit"])) {
    return `Here's your next best action: ${next}`;
  }
  if (includesAny(["hi", "hey", "hello", "sup", "yo"])) {
    return `Hey! You're at ${momentumScore(project)}/100 momentum and I'm feeling ${status.toLowerCase()} 🌱. ${next}`;
  }
  return `I'm here to help you keep momentum on ${project.name}. ${next} If you're stuck on something specific, tell me and we'll break it down together.`;
}
