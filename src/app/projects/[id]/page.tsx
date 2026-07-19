"use client";

import Link from "next/link";
import { FormEvent, use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "@/context/project-context";
import { Blocker, CheckIn, FeedbackRequest, FocusSession, Milestone, Priority, Project, Task, TaskStatus } from "@/lib/types";
import { dateFromNow, formatDate, GROWTH_REWARDS, GrowthReward, isOverdue, momentumLabel, momentumScore, nextBestAction, statusTone, taskProgress, uid } from "@/lib/utils";
import { ProjectForm } from "@/components/project-form";
import { FocusMode } from "@/components/focus-mode";
import { GitHubPulseCard } from "@/components/github-pulse-card";
import { SuggestedTask } from "@/lib/github";
import { AlertIcon, ArrowIcon, BoltIcon, CalendarIcon, CheckIcon, ClockIcon, EditIcon, MessageIcon, PlayIcon, PlusIcon, SparkIcon, TargetIcon, TrashIcon } from "@/components/icons";
import { EmptyState, Field, FormShell, Modal, ModalActions, ProgressBar } from "@/components/ui";

type ModalName = "task" | "milestone" | "blocker" | "checkin" | "feedback" | "project" | null;

const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { projects, hydrated, updateProject, deleteProject, myUserId } = useProjects();
  const project = projects.find((item) => item.id === id);
  const [modal, setModal] = useState<ModalName>(null);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | undefined>();

  const score = useMemo(() => project ? momentumScore(project) : 0, [project]);
  const canEdit = !!project && !!myUserId && project.ownerId === myUserId;
  if (!hydrated) return <div className="page-container"><div className="detail-skeleton" /></div>;
  if (!project) return <div className="page-container"><EmptyState icon={<TargetIcon/>} title="Project not found" text="This project may have been removed." action={<Link href="/" className="button primary">Back to dashboard</Link>} /></div>;

  const save = (changes: Partial<Project>) => { if (canEdit) void updateProject({ ...project, ...changes }); };
  // Award water 💧 and/or sunshine ☀️ to Sprout.
  const withGrowth = (...rewards: GrowthReward[]) => ({
    ...project.companion,
    water: project.companion.water + rewards.reduce((sum, r) => sum + r.water, 0),
    sunshine: project.companion.sunshine + rewards.reduce((sum, r) => sum + r.sunshine, 0),
  });
  const removeProject = () => { if (canEdit && window.confirm(`Delete “${project.name}”? This cannot be undone.`)) { void deleteProject(project.id); router.push("/me"); } };
  const openTask = (task?: Task) => { setEditingTask(task); setModal("task"); };

  // Completing a task earns sunshine (only on the transition into "Done").
  const saveTask = (task: Task) => {
    const prev = project.tasks.find((t) => t.id === task.id);
    const becameDone = task.status === "Done" && prev !== undefined && prev.status !== "Done";
    const tasks = prev ? project.tasks.map((t) => (t.id === task.id ? task : t)) : [...project.tasks, task];
    save(becameDone ? { tasks, companion: withGrowth(GROWTH_REWARDS.task) } : { tasks });
  };
  const toggleMilestone = (m: Milestone) => {
    const becameComplete = !m.completed;
    const milestones = project.milestones.map((x) => (x.id === m.id ? { ...x, completed: becameComplete } : x));
    save(becameComplete ? { milestones, companion: withGrowth(GROWTH_REWARDS.milestone) } : { milestones });
  };
  const toggleBlocker = (b: Blocker) => {
    const becameResolved = !b.resolved;
    const blockers = project.blockers.map((x) => (x.id === b.id ? { ...x, resolved: becameResolved } : x));
    save(becameResolved ? { blockers, companion: withGrowth(GROWTH_REWARDS.blocker) } : { blockers });
  };
  const completeFocus = (session: FocusSession, taskUpdate?: { id: string; status: TaskStatus }) => {
    const prev = taskUpdate ? project.tasks.find((t) => t.id === taskUpdate.id) : undefined;
    const tasks = taskUpdate ? project.tasks.map((t) => (t.id === taskUpdate.id ? { ...t, status: taskUpdate.status } : t)) : project.tasks;
    const rewards: GrowthReward[] = [];
    if (session.completed) rewards.push(GROWTH_REWARDS.focus);
    if (taskUpdate?.status === "Done" && prev?.status !== "Done") rewards.push(GROWTH_REWARDS.task);
    save({ focusSessions: [session, ...project.focusSessions], tasks, companion: withGrowth(...rewards) });
  };
  const startFocus = (taskId?: string) => { setFocusTaskId(taskId); setFocusOpen(true); };
  const addSuggestedTask = (t: SuggestedTask) => {
    const task: Task = { id: uid(), title: t.title, status: t.status, dueDate: dateFromNow(7), priority: t.priority, notes: t.reason };
    save({ tasks: [...project.tasks, task] });
  };

  return <div className="page-container detail-page">
    <Link href={canEdit ? "/me" : "/"} className="back-link"><ArrowIcon /> {canEdit ? "My command center" : "Cohort dashboard"}</Link>
    <section className="project-hero">
      <div className="project-title-block"><div className="project-title-line"><h1>{project.name}</h1><span className={`badge ${statusTone[project.status]}`}>{project.status}</span></div><div className="owner-line hero-owner"><span className="avatar">{initials(project.owner)}</span><span className="owner-name">{project.owner}</span></div><p>{project.description}</p></div>
      {canEdit
        ? <div className="hero-actions"><button className="button secondary" onClick={() => setModal("project")}><EditIcon/> Edit</button><button className="icon-button danger-icon" onClick={removeProject} aria-label="Delete project"><TrashIcon/></button></div>
        : <span className="readonly-chip"><MessageIcon/> Read-only · {project.owner}&apos;s project</span>}
    </section>

    <section className="project-overview">
      <article className="goal-panel"><span className="panel-kicker"><TargetIcon/> PROJECT GOAL</span><p>{project.goal}</p><div className="deadline"><CalendarIcon/><span>Deadline</span><strong>{formatDate(project.deadline)}</strong></div></article>
      <article className="score-panel"><div className="large-score"><div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}><strong>{score}</strong><small>/ 100</small></div><div><span>Momentum score</span><h3>{momentumLabel(score)}</h3><p>Updates as work progresses</p></div></div><div className="next-action"><SparkIcon/><div><span>NEXT BEST ACTION</span><p>{nextBestAction(project)}</p></div></div></article>
    </section>

    <section className="overall-progress"><div><div><span>Overall progress</span><strong>{taskProgress(project.tasks)}%</strong></div><ProgressBar value={taskProgress(project.tasks)} /></div><div className="overview-counts"><span><strong>{project.tasks.filter(t => t.status === "Done").length}</strong> of {project.tasks.length} tasks</span><span><strong>{project.milestones.filter(m => m.completed).length}</strong> of {project.milestones.length} milestones</span><span>💧 <strong>{project.companion.water}</strong> · ☀️ <strong>{project.companion.sunshine}</strong></span></div></section>

    {canEdit && (
      <section className="focus-solo">
        <FocusCard project={project} onStart={startFocus} />
      </section>
    )}

    <SectionHeader title="Task board" subtitle="Move the work forward, one task at a time." action={canEdit ? <button className="button primary compact" onClick={() => openTask()}><PlusIcon/> Add task</button> : undefined} />
    <section className="task-board">{(["To Do", "In Progress", "Done"] as TaskStatus[]).map((status) => <TaskColumn key={status} status={status} tasks={project.tasks.filter(task => task.status === status)} canEdit={canEdit} onEdit={openTask} onUpdate={saveTask} onDelete={(taskId) => save({ tasks: project.tasks.filter(item => item.id !== taskId) })} onFocus={startFocus} />)}</section>

    <section className="two-column">
      <div><SectionHeader title="Weekly milestones" subtitle="Keep the bigger checkpoints in view." action={canEdit ? <button className="text-button" onClick={() => setModal("milestone")}><PlusIcon/> Add milestone</button> : undefined} /><div className="content-card list-card">{project.milestones.length ? project.milestones.map(item => <MilestoneRow key={item.id} item={item} canEdit={canEdit} onToggle={() => toggleMilestone(item)} onDelete={() => save({ milestones: project.milestones.filter(m => m.id !== item.id) })} />) : <MiniEmpty text="No milestones yet." />}</div></div>
      <div><SectionHeader title="Blockers" subtitle="Surface what’s slowing you down." action={canEdit ? <button className="text-button" onClick={() => setModal("blocker")}><PlusIcon/> Add blocker</button> : undefined} /><div className="content-card list-card">{project.blockers.length ? [...project.blockers].sort((a,b) => Number(a.resolved)-Number(b.resolved)).map(item => <BlockerRow key={item.id} item={item} canEdit={canEdit} onToggle={() => toggleBlocker(item)} onDelete={() => save({ blockers: project.blockers.filter(b => b.id !== item.id) })} />) : <MiniEmpty text="No blockers. A clear path forward." />}</div></div>
    </section>

    <SectionHeader title="Feedback requests" subtitle="Flag what you want peers or mentors to weigh in on." action={canEdit ? <button className="button secondary compact" onClick={() => setModal("feedback")}><PlusIcon/> Request feedback</button> : undefined} />
    <div className="content-card list-card">{project.feedbackRequests.length ? [...project.feedbackRequests].sort((a,b) => Number(a.resolved)-Number(b.resolved)).map(item => <FeedbackRow key={item.id} item={item} canEdit={canEdit} onToggle={() => save({ feedbackRequests: project.feedbackRequests.map(f => f.id === item.id ? { ...f, resolved: !f.resolved } : f) })} onDelete={() => save({ feedbackRequests: project.feedbackRequests.filter(f => f.id !== item.id) })} />) : <MiniEmpty text="No open feedback requests." />}</div>

    <SectionHeader title="Daily check-in" subtitle="A quick reflection to keep momentum visible." action={canEdit ? <button className="button secondary compact" onClick={() => setModal("checkin")}><PlusIcon/> New check-in</button> : undefined} />
    <CheckInCard checkIn={project.checkIns[0]} canEdit={canEdit} onCreate={() => setModal("checkin")} />

    {canEdit && (
      <>
        <SectionHeader title="GitHub Pulse" subtitle="Connect a repo, generate a progress pulse, and turn it into board tasks." action={<span className="pill-tag">Read-only</span>} />
        <GitHubPulseCard onAddTask={addSuggestedTask} />
      </>
    )}

    {canEdit && modal === "project" && <ProjectForm initial={project} onClose={() => setModal(null)} onSave={updateProject} />}
    {canEdit && modal === "task" && <TaskForm initial={editingTask} onClose={() => { setModal(null); setEditingTask(undefined); }} onSave={(task) => { saveTask(task); }} />}
    {canEdit && modal === "milestone" && <MilestoneForm onClose={() => setModal(null)} onSave={(milestone) => save({ milestones: [...project.milestones, milestone] })} />}
    {canEdit && modal === "blocker" && <BlockerForm onClose={() => setModal(null)} onSave={(blocker) => save({ blockers: [blocker, ...project.blockers] })} />}
    {canEdit && modal === "checkin" && <CheckInForm onClose={() => setModal(null)} onSave={(checkIn) => save({ checkIns: [checkIn, ...project.checkIns], companion: withGrowth(GROWTH_REWARDS.checkIn) })} />}
    {canEdit && modal === "feedback" && <FeedbackForm onClose={() => setModal(null)} onSave={(request) => save({ feedbackRequests: [request, ...project.feedbackRequests] })} />}
    {focusOpen && <FocusMode project={project} initialTaskId={focusTaskId} onClose={() => setFocusOpen(false)} onComplete={completeFocus} />}
  </div>;
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="detail-section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>; }

function FocusCard({ project, onStart }: { project: Project; onStart: (taskId?: string) => void }) {
  const recent = [...project.focusSessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const totalMinutes = project.focusSessions.filter((s) => s.completed).reduce((sum, s) => sum + s.minutes, 0);
  return <article className="focus-card">
    <div className="focus-card-head"><div><span className="panel-kicker"><ClockIcon/> FOCUS SESSIONS</span><h3>{totalMinutes} min focused</h3></div><button className="button primary compact" onClick={() => onStart()}><PlayIcon/> Start</button></div>
    <div className="focus-history">
      {recent.length ? recent.map((s) => (
        <div className={`focus-history-row ${s.completed ? "" : "interrupted"}`} key={s.id}>
          <span className="focus-dot" />
          <div><strong>{s.taskTitle}</strong><span>{s.minutes} min · {s.completed ? "completed" : "ended early"}</span></div>
        </div>
      )) : <MiniEmpty text="No focus sessions yet. Pick a task and focus for 25 minutes." />}
    </div>
  </article>;
}

function TaskColumn({ status, tasks, canEdit, onEdit, onUpdate, onDelete, onFocus }: { status: TaskStatus; tasks: Task[]; canEdit: boolean; onEdit: (task: Task) => void; onUpdate: (task: Task) => void; onDelete: (id: string) => void; onFocus: (id: string) => void }) {
  const dots: Record<TaskStatus,string> = { "To Do": "gray", "In Progress": "purple", Done: "green" };
  return <div className="task-column"><div className="column-title"><div><span className={`dot ${dots[status]}`}/><h3>{status}</h3><b>{tasks.length}</b></div></div><div className="task-list">{tasks.map(task => <article className={`task-card ${isOverdue(task) ? "overdue" : ""}`} key={task.id}>
    <div className="task-card-head"><span className={`badge ${statusTone[task.priority]}`}>{task.priority}</span>{canEdit && <div>{status !== "Done" && <button className="tiny-icon" onClick={() => onFocus(task.id)} aria-label="Focus on task"><PlayIcon/></button>}<button className="tiny-icon" onClick={() => onEdit(task)} aria-label="Edit task"><EditIcon/></button><button className="tiny-icon" onClick={() => onDelete(task.id)} aria-label="Delete task"><TrashIcon/></button></div>}</div>
    <h4>{task.title}</h4>{task.notes && <p>{task.notes}</p>}<div className="task-due"><CalendarIcon/><span>{isOverdue(task) ? "Overdue · " : ""}{formatDate(task.dueDate)}</span></div>
    {canEdit && <select aria-label={`Change status for ${task.title}`} value={task.status} onChange={e => onUpdate({ ...task, status: e.target.value as TaskStatus })}><option>To Do</option><option>In Progress</option><option>Done</option></select>}
  </article>)}{!tasks.length && <div className="column-empty">No tasks here</div>}</div></div>;
}

function MilestoneRow({ item, canEdit, onToggle, onDelete }: { item: Milestone; canEdit: boolean; onToggle: () => void; onDelete: () => void }) { return <div className={`list-row ${item.completed ? "is-complete" : ""}`}><button className="check-button" onClick={canEdit ? onToggle : undefined} disabled={!canEdit}>{item.completed && <CheckIcon/>}</button><div className="list-copy"><strong>{item.title}</strong><span><CalendarIcon/> {formatDate(item.targetDate)}</span></div>{canEdit && <button className="tiny-icon" onClick={onDelete} aria-label="Delete milestone"><TrashIcon/></button>}</div>; }
function BlockerRow({ item, canEdit, onToggle, onDelete }: { item: Blocker; canEdit: boolean; onToggle: () => void; onDelete: () => void }) { return <div className={`list-row blocker-row ${item.resolved ? "is-complete" : ""}`}><div className="blocker-icon"><AlertIcon/></div><div className="list-copy"><strong>{item.title}</strong>{item.description && <em>{item.description}</em>}{canEdit && <button onClick={onToggle}>{item.resolved ? "Reopen" : "Mark resolved"}</button>}</div><span className={`badge ${item.resolved ? "badge-green" : "badge-red"}`}>{item.resolved ? "Resolved" : "Open"}</span>{canEdit && <button className="tiny-icon" onClick={onDelete} aria-label="Delete blocker"><TrashIcon/></button>}</div>; }
function FeedbackRow({ item, canEdit, onToggle, onDelete }: { item: FeedbackRequest; canEdit: boolean; onToggle: () => void; onDelete: () => void }) { return <div className={`list-row feedback-row ${item.resolved ? "is-complete" : ""}`}><div className="feedback-icon"><MessageIcon/></div><div className="list-copy"><strong>{item.topic}</strong>{canEdit && <button onClick={onToggle}>{item.resolved ? "Reopen" : "Mark reviewed"}</button>}</div><span className={`badge ${statusTone[item.priority]}`}>{item.priority}</span><span className={`badge ${item.resolved ? "badge-green" : "badge-amber"}`}>{item.resolved ? "Reviewed" : "Open"}</span>{canEdit && <button className="tiny-icon" onClick={onDelete} aria-label="Delete feedback request"><TrashIcon/></button>}</div>; }
function MiniEmpty({ text }: { text: string }) { return <div className="mini-empty">{text}</div>; }

function CheckInCard({ checkIn, canEdit, onCreate }: { checkIn?: CheckIn; canEdit: boolean; onCreate: () => void }) {
  if (!checkIn) return <div className="content-card"><EmptyState icon={<BoltIcon/>} title="No check-ins yet" text="Capture today’s progress and decide what comes next." action={canEdit ? <button className="button primary" onClick={onCreate}>Create check-in</button> : undefined} /></div>;
  return <article className="checkin-card"><div className="checkin-top"><span>Latest check-in</span><div className="checkin-meta">{checkIn.feeling && <span className="feeling-chip">Feeling: {checkIn.feeling}</span>}<time>{new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(checkIn.createdAt))}</time></div></div><div className="checkin-grid"><div><span className="checkin-symbol done"><CheckIcon/></span><p>Completed today</p><strong>{checkIn.completedToday}</strong></div><div><span className="checkin-symbol stuck"><AlertIcon/></span><p>Stuck on</p><strong>{checkIn.stuckOn || "Nothing right now"}</strong></div><div><span className="checkin-symbol next"><ArrowIcon/></span><p>Next step</p><strong>{checkIn.nextStep}</strong></div></div></article>;
}

function TaskForm({ initial, onClose, onSave }: { initial?: Task; onClose: () => void; onSave: (task: Task) => void }) {
  const [title,setTitle]=useState(initial?.title??""); const [status,setStatus]=useState<TaskStatus>(initial?.status??"To Do"); const [dueDate,setDueDate]=useState(initial?.dueDate??""); const [priority,setPriority]=useState<Priority>(initial?.priority??"Medium"); const [notes,setNotes]=useState(initial?.notes??"");
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!title.trim()||!dueDate)return;onSave({id:initial?.id??uid(),title:title.trim(),status,dueDate,priority,notes:notes.trim()});onClose();};
  return <Modal title={initial?"Edit task":"Add a task"} subtitle="Make the next piece of work clear and actionable." onClose={onClose}><FormShell onSubmit={submit}><Field label="Task title" required><input autoFocus required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="What needs to get done?"/></Field><div className="form-grid"><Field label="Status"><select value={status} onChange={e=>setStatus(e.target.value as TaskStatus)}><option>To Do</option><option>In Progress</option><option>Done</option></select></Field><Field label="Priority"><select value={priority} onChange={e=>setPriority(e.target.value as Priority)}><option>Low</option><option>Medium</option><option>High</option></select></Field></div><Field label="Due date" required><input required type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></Field><Field label="Notes"><textarea rows={3} maxLength={300} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional context or details"/></Field><ModalActions onCancel={onClose} submitLabel={initial?"Save changes":"Add task"}/></FormShell></Modal>;
}
function MilestoneForm({onClose,onSave}:{onClose:()=>void;onSave:(m:Milestone)=>void}) { const [title,setTitle]=useState("");const [date,setDate]=useState("");const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!title.trim()||!date)return;onSave({id:uid(),title:title.trim(),targetDate:date,completed:false});onClose();};return <Modal title="Add weekly milestone" subtitle="Define a checkpoint worth reaching." onClose={onClose}><FormShell onSubmit={submit}><Field label="Milestone title" required><input autoFocus required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Week 2 — User testing"/></Field><Field label="Target date" required><input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><ModalActions onCancel={onClose} submitLabel="Add milestone"/></FormShell></Modal>; }
function BlockerForm({onClose,onSave}:{onClose:()=>void;onSave:(b:Blocker)=>void}) { const [title,setTitle]=useState("");const [description,setDescription]=useState("");const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!title.trim())return;onSave({id:uid(),title:title.trim(),description:description.trim(),resolved:false,createdAt:new Date().toISOString()});onClose();};return <Modal title="Add a blocker" subtitle="Name what’s in the way so you can address it." onClose={onClose}><FormShell onSubmit={submit}><Field label="Blocker" required><input autoFocus required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Stuck connecting the database"/></Field><Field label="Details"><textarea rows={3} maxLength={280} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What have you tried? What do you need?"/></Field><ModalActions onCancel={onClose} submitLabel="Add blocker"/></FormShell></Modal>; }
function FeedbackForm({onClose,onSave}:{onClose:()=>void;onSave:(f:FeedbackRequest)=>void}) { const [topic,setTopic]=useState("");const [priority,setPriority]=useState<Priority>("Medium");const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!topic.trim())return;onSave({id:uid(),topic:topic.trim(),priority,resolved:false,createdAt:new Date().toISOString()});onClose();};return <Modal title="Request feedback" subtitle="Tell the cohort exactly what you want eyes on." onClose={onClose}><FormShell onSubmit={submit}><Field label="What do you need feedback on?" required><textarea autoFocus required rows={3} maxLength={240} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Is the onboarding flow clear enough?"/></Field><Field label="Priority"><select value={priority} onChange={e=>setPriority(e.target.value as Priority)}><option>Low</option><option>Medium</option><option>High</option></select></Field><ModalActions onCancel={onClose} submitLabel="Request feedback"/></FormShell></Modal>; }
function CheckInForm({onClose,onSave}:{onClose:()=>void;onSave:(c:CheckIn)=>void}) { const [done,setDone]=useState("");const [stuck,setStuck]=useState("");const [next,setNext]=useState("");const [feeling,setFeeling]=useState("");const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!done.trim()||!next.trim())return;onSave({id:uid(),completedToday:done.trim(),stuckOn:stuck.trim(),nextStep:next.trim(),feeling:feeling.trim(),createdAt:new Date().toISOString()});onClose();};return <Modal title="Daily check-in" subtitle="Reflect for a minute. Leave with a clear next step." onClose={onClose}><FormShell onSubmit={submit}><Field label="What did you complete today?" required><textarea autoFocus required rows={2} maxLength={300} value={done} onChange={e=>setDone(e.target.value)} placeholder="I completed…"/></Field><Field label="What are you stuck on?"><textarea rows={2} maxLength={300} value={stuck} onChange={e=>setStuck(e.target.value)} placeholder="I need help with…"/></Field><Field label="What is your next step?" required><textarea required rows={2} maxLength={300} value={next} onChange={e=>setNext(e.target.value)} placeholder="Next, I will…"/></Field><Field label="How are you feeling about progress?"><input maxLength={80} value={feeling} onChange={e=>setFeeling(e.target.value)} placeholder="e.g. Motivated, a bit behind, energized…"/></Field><ModalActions onCancel={onClose} submitLabel="Save check-in"/></FormShell></Modal>; }
