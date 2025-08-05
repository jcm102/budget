
export type TaskFrequency = "daily" | "weekly" | "monthly";

export interface Subtask {
  id: string;
  description: string;
  completed: boolean;
  order: number;
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
  order: number;
}

export interface Debt {
  id:string;
  name: string;
  balance: number;
  minimumPayment: number;
  actualPayment: number;
  dueDate: string; // Should be a date string
}

export type BudgetItemType = 'Income' | 'Debt Payments' | 'Transfers' | 'Pre-Authorized Payments';
export type BudgetItemFrequency = 'One-Time' | 'Weekly' | 'Bi-Weekly' | 'Monthly';

export interface BudgetItem {
  id: string;
  type: BudgetItemType;
  category: string;
  description: string;
  amount: number;
  date: string; // ISO string
  frequency: BudgetItemFrequency;
  transferTo?: string;
  transferFrom?: string;
}

export interface Category {
    id: string;
    name: string;
}

export interface Transferee {
    id: string;
    name: string;
}

export type ExpenseType = 'Monetary' | 'Mileage';

interface BaseExpense {
  id: string;
  type: ExpenseType;
  description: string;
  date: string; // ISO string
}

export interface Expense extends BaseExpense {
  type: 'Monetary';
  amount: number;
  category: string;
  transferee: string;
  reimbursable: boolean;
}

export interface MileageLog extends BaseExpense {
  type: 'Mileage';
  distance: number;
  rate: number;
  origin?: string;
  destination?: string;
}
