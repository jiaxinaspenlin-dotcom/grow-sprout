"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FocusSession, Project, Task, TaskStatus } from "@/lib/types";
import { uid } from "@/lib/utils";
import { MusicIcon, PauseIcon, PlayIcon } from "./icons";
import { Field } from "./ui";

const LENGTHS = [15, 25, 45, 60];
const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

type Phase = "setup" | "running" | "review";

export function FocusMode({
  project,
  initialTaskId,
  onClose,
  onComplete,
}: {
  project: Project;
  initialTaskId?: string;
  onClose: () => void;
  onComplete: (session: FocusSession, taskUpdate?: { id: string; status: TaskStatus }) => void;
}) {
  const openTasks = useMemo(() => project.tasks.filter((t) => t.status !== "Done"), [project.tasks]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [taskId, setTaskId] = useState<string>(initialTaskId ?? openTasks[0]?.id ?? "");
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [paused, setPaused] = useState(false);
  const [lofi, setLofi] = useState(false);
  const [interrupted, setInterrupted] = useState(false);

  const selectedTask: Task | undefined = project.tasks.find((t) => t.id === taskId);
  const taskTitle = selectedTask?.title ?? "Deep work";

  const doneRef = useRef(false);
  useEffect(() => {
    if (phase !== "running" || paused) return;
    if (remaining <= 0) {
      if (!doneRef.current) { doneRef.current = true; setInterrupted(false); setPhase("review"); }
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, paused, remaining]);

  const start = () => {
    doneRef.current = false;
    setRemaining(minutes * 60);
    setPaused(false);
    setPhase("running");
  };

  const endEarly = () => { setInterrupted(true); setPhase("review"); };

  const finish = (data: { note: string; move: "" | TaskStatus }) => {
    const session: FocusSession = {
      id: uid(),
      taskId: selectedTask?.id,
      taskTitle,
      minutes,
      completed: !interrupted,
      interrupted,
      note: data.note.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const taskUpdate = data.move && selectedTask ? { id: selectedTask.id, status: data.move } : undefined;
    onComplete(session, taskUpdate);
    onClose();
  };

  const progress = phase === "running" ? 1 - remaining / (minutes * 60) : 0;

  return (
    <div className="focus-backdrop">
      <div className={`focus-screen ${lofi ? "lofi" : ""}`} role="dialog" aria-modal="true" aria-label="Focus session">
        {phase === "setup" && (
          <div className="focus-setup">
            <span className="focus-kicker">FOCUS SESSION</span>
            <h2>What are you focusing on?</h2>
            {openTasks.length ? (
              <Field label="Task">
                <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                  {openTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                </select>
              </Field>
            ) : (
              <p className="focus-note">No open tasks — you&apos;ll focus on general deep work. Add tasks to focus on specific work.</p>
            )}
            <div className="focus-lengths">
              {LENGTHS.map((m) => (
                <button key={m} type="button" className={m === minutes ? "active" : ""} onClick={() => setMinutes(m)}>{m}<small>min</small></button>
              ))}
            </div>
            <div className="focus-actions">
              <button className="button secondary" onClick={onClose}>Cancel</button>
              <button className="button primary large" onClick={start}><PlayIcon /> Start focus</button>
            </div>
          </div>
        )}

        {phase === "running" && (
          <div className="focus-running">
            <button className="focus-lofi" onClick={() => setLofi((v) => !v)} aria-pressed={lofi}>
              <MusicIcon /> {lofi ? "Lo-fi on" : "Lo-fi off"}
              {lofi && <span className="eq"><i /><i /><i /><i /></span>}
            </button>
            <span className="focus-kicker">FOCUSING ON</span>
            <h2>{taskTitle}</h2>
            <div className="focus-timer" style={{ "--p": progress } as React.CSSProperties}>
              <span>{fmt(remaining)}</span>
            </div>
            <p className="focus-cheer">🌱 You&apos;ve got this — stay with it. Small focused blocks build real momentum.</p>
            <div className="focus-actions">
              <button className="button secondary" onClick={() => setPaused((p) => !p)}>
                {paused ? <><PlayIcon /> Resume</> : <><PauseIcon /> Pause</>}
              </button>
              <button className="button primary" onClick={endEarly}>End session</button>
            </div>
          </div>
        )}

        {phase === "review" && <ReviewForm interrupted={interrupted} minutes={minutes} taskTitle={taskTitle} hasTask={!!selectedTask} onSubmit={finish} />}
      </div>
    </div>
  );
}

function ReviewForm({
  interrupted,
  minutes,
  taskTitle,
  hasTask,
  onSubmit,
}: {
  interrupted: boolean;
  minutes: number;
  taskTitle: string;
  hasTask: boolean;
  onSubmit: (data: { note: string; move: "" | TaskStatus }) => void;
}) {
  const [note, setNote] = useState("");
  const [move, setMove] = useState<"" | TaskStatus>("");
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); onSubmit({ note, move }); };

  return (
    <form className="focus-review" onSubmit={submit}>
      <span className="focus-kicker">{interrupted ? "SESSION ENDED EARLY" : "SESSION COMPLETE 🎉"}</span>
      <h2>{interrupted ? "No worries — what got in the way?" : `Nice — ${minutes} focused minutes on "${taskTitle}"`}</h2>
      {!interrupted && <p className="focus-note">You watered Sprout by finishing. 💧</p>}
      <Field label={interrupted ? "What got in the way?" : "What did you complete?"}>
        <textarea autoFocus rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder={interrupted ? "e.g. Got pulled into a meeting…" : "e.g. Wired up the results view…"} />
      </Field>
      {hasTask && (
        <Field label="Move this task to…">
          <select value={move} onChange={(e) => setMove(e.target.value as "" | TaskStatus)}>
            <option value="">Leave it where it is</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>
        </Field>
      )}
      <div className="focus-actions">
        <button className="button primary large" type="submit">Save &amp; finish</button>
      </div>
    </form>
  );
}
