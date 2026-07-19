export type ProjectStatus = "Not Started" | "In Progress" | "At Risk" | "Complete";
export type TaskStatus = "To Do" | "In Progress" | "Done";
export type Priority = "Low" | "Medium" | "High";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string;
  priority: Priority;
  notes?: string;
}

export interface Milestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
}

export interface Blocker {
  id: string;
  title: string;
  description: string;
  resolved: boolean;
  createdAt: string;
}

export interface CheckIn {
  id: string;
  completedToday: string;
  stuckOn: string;
  nextStep: string;
  feeling: string;
  createdAt: string;
}

export interface FeedbackRequest {
  id: string;
  topic: string;
  priority: Priority;
  resolved: boolean;
  createdAt: string;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  taskTitle: string;
  minutes: number;
  completed: boolean;
  interrupted: boolean;
  note?: string;
  createdAt: string;
}

export type CompanionMood = "Energized" | "Happy" | "Concerned" | "Tired" | "Needs help";
export type ChatRole = "user" | "companion";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface CompanionState {
  /** Earned by nurturing the project: daily check-ins and focus sessions. */
  water: number;
  /** Earned by making progress: completing tasks, resolving blockers, hitting milestones. */
  sunshine: number;
  messages: ChatMessage[];
}

export interface Project {
  id: string;
  name: string;
  /** Display name of the owning builder (from their GitHub profile). */
  owner: string;
  /** Database id of the owning User — drives edit permissions. */
  ownerId: string;
  description: string;
  goal: string;
  deadline: string;
  status: ProjectStatus;
  createdAt: string;
  tasks: Task[];
  milestones: Milestone[];
  blockers: Blocker[];
  checkIns: CheckIn[];
  feedbackRequests: FeedbackRequest[];
  focusSessions: FocusSession[];
  companion: CompanionState;
}
