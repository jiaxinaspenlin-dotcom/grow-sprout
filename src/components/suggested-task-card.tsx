"use client";

import { useState } from "react";
import { SuggestedTask } from "@/lib/github";
import { statusTone } from "@/lib/utils";
import { CheckIcon, PlusIcon } from "./icons";

export function SuggestedTaskCard({ task, onAdd }: { task: SuggestedTask; onAdd: (task: SuggestedTask) => void }) {
  const [added, setAdded] = useState(false);
  return (
    <div className="suggested-task">
      <div className="st-top">
        <span className={`badge ${statusTone[task.priority]}`}>{task.priority}</span>
        <span className="st-status">{task.status}</span>
      </div>
      <h4>{task.title}</h4>
      <p>{task.reason}</p>
      <button className={`button compact ${added ? "secondary" : "primary"}`} disabled={added} onClick={() => { onAdd(task); setAdded(true); }}>
        {added ? <><CheckIcon /> Added</> : <><PlusIcon /> Add to board</>}
      </button>
    </div>
  );
}
