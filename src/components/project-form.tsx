"use client";

import { FormEvent, useState } from "react";
import { Project, ProjectStatus } from "@/lib/types";
import { uid } from "@/lib/utils";
import { Field, FormShell, Modal, ModalActions } from "./ui";

export function ProjectForm({ onClose, onSave, initial }: { onClose: () => void; onSave: (project: Project) => void | Promise<void>; initial?: Project }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "Not Started");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !goal.trim() || !deadline) return;
    // owner / ownerId are set server-side from the signed-in user; values here are ignored on create.
    await onSave({ id: initial?.id ?? uid(), name: name.trim(), owner: initial?.owner ?? "", ownerId: initial?.ownerId ?? "", description: description.trim(), goal: goal.trim(), deadline, status, createdAt: initial?.createdAt ?? new Date().toISOString(), tasks: initial?.tasks ?? [], milestones: initial?.milestones ?? [], blockers: initial?.blockers ?? [], checkIns: initial?.checkIns ?? [], feedbackRequests: initial?.feedbackRequests ?? [], focusSessions: initial?.focusSessions ?? [], companion: initial?.companion ?? { water: 0, sunshine: 0, messages: [] } });
    onClose();
  };

  return <Modal title={initial ? "Edit project" : "Add a project"} subtitle="Give your work a clear destination." onClose={onClose}>
    <FormShell onSubmit={submit}>
      <Field label="Project name" required><input autoFocus required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. StudyBuddy AI" /></Field>
      <Field label="Description"><textarea rows={2} maxLength={220} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you building?" /></Field>
      <Field label="Goal" required><textarea required rows={2} maxLength={220} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What does success look like?" /></Field>
      <div className="form-grid">
        <Field label="Deadline" required><input required type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}><option>Not Started</option><option>In Progress</option><option>At Risk</option><option>Complete</option></select></Field>
      </div>
      <ModalActions onCancel={onClose} submitLabel={initial ? "Save changes" : "Create project"} />
    </FormShell>
  </Modal>;
}
