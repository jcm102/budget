export type TaskFrequency = "daily" | "weekly" | "monthly";

export interface Subtask {
  id: string;
  description: string;
  completed: boolean;
}

export interface Task {
  id: string;
  description: string;
  details?: string | null;
  dueDate?: string | null; // ISO string
  frequency: TaskFrequency;
  completed: boolean;
  completedAt: string | null; // ISO string
  subtasks: Subtask[];
}
