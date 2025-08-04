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

export interface Debt {
  id:string;
  name: string;
  balance: number;
  minimumPayment: number;
  actualPayment: number;
  dueDate: string; // Should be a date string
}

export type BudgetItemType = 'Income' | 'Debt Payments' | 'Transfers';

export interface BudgetItem {
  id: string;
  type: BudgetItemType;
  category: string;
  description: string;
  amount: number;
  date: string; // ISO string
  transferTo?: string;
  transferFrom?: string;
}

export interface Category {
    id: string;
    name: string;
}
