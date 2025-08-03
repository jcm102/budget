export type TaskFrequency = "daily" | "weekly" | "monthly";

export interface Task {
  id: string;
  description: string;
  dueDate: string; // ISO string
  frequency: TaskFrequency;
  completed: boolean;
  completedAt?: string | null; // ISO string
}
