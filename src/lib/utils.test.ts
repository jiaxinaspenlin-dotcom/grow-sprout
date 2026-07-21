import { describe, expect, it } from "vitest";
import type { CheckIn, Project, Task } from "./types";
import {
  aggregateMomentum,
  cohortStats,
  isOverdue,
  momentumLabel,
  momentumScore,
  plantHealth,
  plantStatus,
  projectSignals,
  taskProgress,
} from "./utils";

// Helpers relative to "now" so tests don't depend on absolute wall-clock dates.
// daysFromNow returns a full ISO timestamp (recency math is tz-independent);
// dateFromNow returns a *local* yyyy-mm-dd so overdue comparisons don't flip
// across the UTC midnight boundary the way toISOString().split() would.
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};
const dateFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const task = (over: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(),
  title: "Task",
  status: "To Do",
  dueDate: dateFromNow(7),
  priority: "Medium",
  ...over,
});

const checkIn = (createdAt: string): CheckIn => ({
  id: crypto.randomUUID(),
  completedToday: "x",
  stuckOn: "",
  nextStep: "y",
  feeling: "",
  createdAt,
});

const project = (over: Partial<Project> = {}): Project => ({
  id: crypto.randomUUID(),
  name: "P",
  owner: "Builder",
  ownerId: "u1",
  description: "",
  goal: "",
  deadline: dateFromNow(30),
  status: "In Progress",
  createdAt: daysFromNow(-10),
  tasks: [],
  milestones: [],
  blockers: [],
  checkIns: [],
  feedbackRequests: [],
  focusSessions: [],
  companion: { water: 0, sunshine: 0, messages: [] },
  ...over,
});

describe("isOverdue", () => {
  it("is true for a past-due unfinished task", () => {
    expect(isOverdue(task({ dueDate: dateFromNow(-2), status: "To Do" }))).toBe(true);
  });
  it("is false once the task is Done, even if past due", () => {
    expect(isOverdue(task({ dueDate: dateFromNow(-2), status: "Done" }))).toBe(false);
  });
  it("is false for a future due date", () => {
    expect(isOverdue(task({ dueDate: dateFromNow(3) }))).toBe(false);
  });
});

describe("taskProgress", () => {
  it("is 0 with no tasks", () => expect(taskProgress([])).toBe(0));
  it("rounds the done ratio to a percentage", () => {
    expect(taskProgress([task({ status: "Done" }), task({ status: "To Do" }), task({ status: "To Do" })])).toBe(33);
  });
});

describe("momentumScore", () => {
  it("gives a fresh empty project partial credit (blockers full, no check-in)", () => {
    // No tasks (0), no blockers => 15, no milestones (0), no check-in (0),
    // no focus (0), no penalties => 15.
    expect(momentumScore(project())).toBe(15);
  });

  it("awards the full task weight (35) when every task is done", () => {
    const p = project({ tasks: [task({ status: "Done" }), task({ status: "Done" })] });
    // 35 (tasks) + 15 (no open blockers) = 50.
    expect(momentumScore(p)).toBe(50);
  });

  it("rewards a same-day check-in with the full 20", () => {
    const withCheckIn = project({ checkIns: [checkIn(daysFromNow(0))] });
    const without = project();
    expect(momentumScore(withCheckIn) - momentumScore(without)).toBe(20);
  });

  it("penalizes overdue tasks and never drops below 0", () => {
    const p = project({ tasks: Array.from({ length: 5 }, () => task({ dueDate: dateFromNow(-3), status: "To Do" })) });
    expect(momentumScore(p)).toBeGreaterThanOrEqual(0);
  });

  it("stays within 0..100", () => {
    const p = project({
      tasks: [task({ status: "Done" })],
      milestones: [{ id: "m", title: "m", targetDate: dateFromNow(1), completed: true }],
      checkIns: [checkIn(daysFromNow(0))],
      focusSessions: Array.from({ length: 6 }, () => ({ id: crypto.randomUUID(), taskTitle: "t", minutes: 25, completed: true, interrupted: false, createdAt: daysFromNow(-1) })),
    });
    const score = momentumScore(p);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("momentumLabel", () => {
  it("never returns 'At risk' (reserved for status/filter meaning)", () => {
    for (let s = 0; s <= 100; s += 5) expect(momentumLabel(s)).not.toBe("At risk");
  });
  it("maps score bands to labels", () => {
    expect(momentumLabel(90)).toBe("Strong momentum");
    expect(momentumLabel(60)).toBe("On track");
    expect(momentumLabel(30)).toBe("Needs attention");
    expect(momentumLabel(10)).toBe("Losing steam");
  });
});

describe("projectSignals", () => {
  it("flags blocked when a blocker is open", () => {
    const p = project({ blockers: [{ id: "b", title: "b", description: "", resolved: false, createdAt: daysFromNow(-1) }] });
    expect(projectSignals(p)).toContain("blocked");
  });
  it("flags at-risk on overdue work", () => {
    const p = project({ tasks: [task({ dueDate: dateFromNow(-1), status: "To Do" })] });
    expect(projectSignals(p)).toContain("at-risk");
  });
  it("flags on-track for a clean in-progress project", () => {
    expect(projectSignals(project())).toEqual(["on-track"]);
  });
});

describe("plantHealth / plantStatus", () => {
  it("a clean project is Thriving", () => {
    expect(plantStatus(project())).toBe("Thriving");
  });
  it("overdue work dries the plant out", () => {
    const p = project({ tasks: [task({ dueDate: dateFromNow(-2), status: "To Do" }), task({ dueDate: dateFromNow(-2), status: "To Do" })] });
    expect(plantHealth(p)).toBeLessThan(plantHealth(project()));
  });
});

describe("cohortStats / aggregateMomentum", () => {
  it("rolls up counts across projects", () => {
    const a = project({ tasks: [task({ status: "Done" }), task({ dueDate: dateFromNow(-1), status: "To Do" })] });
    const b = project({ blockers: [{ id: "b", title: "b", description: "", resolved: false, createdAt: daysFromNow(-1) }] });
    const stats = cohortStats([a, b]);
    expect(stats.projects).toBe(2);
    expect(stats.tasks).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.overdue).toBe(1);
    expect(stats.blockers).toBe(1);
  });
  it("averages momentum, 0 for an empty cohort", () => {
    expect(aggregateMomentum([])).toBe(0);
  });
});
