

export type TaskFrequency = "daily" | "weekly" | "monthly";

export const internalPages = [
  { name: 'Debt Worksheet', path: '/debt' },
  { name: 'Budget Overview', path: '/budget' },
  { name: 'Work Expenses', path: '/expenses' },
  { name: 'Future Spending', path: '/savings' },
  { name: 'Split Calculator', path: '/split' },
  { name: 'Settings', path: '/settings' },
];

export interface Subtask {
  id: string;
  description: string;
  completed: boolean;
  order: number;
  links?: string[];
  linkGroupId?: string | null;
  internalLink?: string | null;
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
  links?: string[];
  linkGroupId?: string | null;
  internalLink?: string | null;
}

export interface Debt {
  id:string;
  name: string;
  order: number;
  // Current Month
  balance: number;
  minimumPayment: number;
  actualPayment: number;
  dueDate: string; // Should be a date string
  paid?: boolean;
  // Next Month
  nextBalance?: number;
  nextMinimumPayment?: number;
  nextDueDate?: string;
  nextPaid?: boolean;
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
  originalId?: string; // To track edited recurring instances
  completed?: boolean;
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
  status: 'active' | 'archived';
  archiveKey?: string; // e.g., '2024-08'
}

export interface Expense extends BaseExpense {
  type: 'Monetary';
  amount: number;
  category: string;
  transferee: string;
  reimbursable: boolean;
  frequency: BudgetItemFrequency;
  originalId?: string;
  completed?: boolean;
}

export type TripType = 'One-Way' | 'Return';

export interface MileageLog extends BaseExpense {
  type: 'Mileage';
  distance: number;
  rate: number;
  origin?: string;
  destination?: string;
  tripType?: TripType;
}

export type SavingsPurchaseFrequency = 'Semi-Annually' | 'Annually' | 'Every 2 Years' | 'Every 3 Years' | 'Every 4 Years' | 'Every 5 Years';

export interface SavingsItem {
  id: string;
  expense: string;
  purchaseFrequency: SavingsPurchaseFrequency;
  cost: number;
  isSplit: boolean;
  annualIncrease: number;
  renewalDate: string; // ISO string
  totalBudgeted: number;
}

export type AutoShipFrequency = 'Monthly' | 'Every 2 Months' | 'Every 3 Months' | 'Every 4 Months' | 'Every 6 Months';

export interface AutoShipItem {
    id: string;
    item: string;
    nextShipmentDate: string; // ISO string
    frequency: AutoShipFrequency;
    estimatedCost: number;
}

export type SubscriptionBillingFrequency = 'Monthly' | 'Quarterly' | 'Annually';

export interface SubscriptionItem {
  id: string;
  serviceName: string;
  billingFrequency: SubscriptionBillingFrequency;
  cost: number;
}


export interface LinkGroup {
  id: string;
  name: string;
  links: string[];
}

export interface Person {
  id: string;
  name: string;
  createdAt: string; // ISO string
}

export type GoalType = 'fixed' | 'monthly';

export interface Goal {
  id: string;
  name: string;
  amount: number;
  url?: string | null;
}
