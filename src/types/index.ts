

export type TaskFrequency = "daily" | "weekly" | "monthly";

export const internalPages = [
  { name: 'Debt Worksheet', path: '/debt' },
  { name: 'Budget Overview', path: '/budget' },
  { name: 'Work Expenses', path: '/expenses' },
  { name: 'Future Spending', path: '/savings' },
  { name: 'Split Calculator', path: '/split' },
  { name: 'Settings', path: '/settings' },
  { name: 'Monthly Budget', path: '/monthly-budget' },
  { name: 'Accounts', path: '/accounts' },
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

export type DebtType = 'Credit Card' | 'Loan' | 'Line of Credit';

export interface Debt {
  id:string;
  name: string;
  order: number;
  interestRate: number;
  debtType?: DebtType;
  // Current Month
  balance: number;
  minimumPayment: number;
  plannedPayment: number;
  dueDate: string; // Should be a date string
  paid?: boolean;
  // Next Month
  nextBalance?: number;
  nextMinimumPayment?: number;
  nextDueDate?: string;
  nextPaid?: boolean;
}

export type BudgetItemType = 'Income' | 'Debt Payments' | 'Transfers' | 'Pre-Authorized Payments';
export type BudgetItemFrequency = 'One-Time' | 'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Monthly (Last Day)';

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
  allocationType?: 'none' | 'goal' | 'debt';
  allocationTargetId?: string;
  allocationAmount?: number;
  forNextMonth?: boolean;
}

export interface Category {
    id: string;
    name: string;
    parentId?: string | null;
}

export type AccountType = 'Chequing' | 'Savings' | 'Credit' | 'Gift Card' | 'IOU';

export interface AccountDetails {
    id: string;
    name: string;
    type: AccountType;
    balance?: number;
    linkedDebtId?: string | null;
}


export type ExpenseType = 'Monetary' | 'Mileage' | 'Honorarium';

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

export interface Honorarium extends BaseExpense {
    type: 'Honorarium';
    amount: number;
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

export type SavingsRecurrence = 'None' | 'Quarterly' | 'Semi-Annually' | 'Annually' | 'Bi-Annually';

export interface SavingsItem {
  id: string;
  accountId: string;
  name: string;
  amount: number;
  currency: 'CAD' | 'USD';
  goal?: number; // Monthly contribution goal
  totalCost?: number | null; // Optional total cost for the fund
  savingsTarget?: number | null; // Optional personal savings goal if different from totalCost
  dueDate?: string | null; // Optional due date for the fund
  recurrence?: SavingsRecurrence | null;
  parentId?: string | null;
  
  // These fields are calculated at runtime for display
  monthlyAmount?: number;
}


export interface AccountLedgerItem {
  id: string;
  accountId: string;
  name: string;
  amount: number;
}

export type AutoShipFrequency = 'Monthly' | 'Every 2 Months' | 'Every 3 Months' | 'Every 4 Months' | 'Every 6 Months';

export interface AutoShipItem {
    id: string;
    accountId: string;
    item: string;
    nextShipmentDate: string; // ISO string
    frequency: AutoShipFrequency;
    estimatedCost: number;
    type: 'Auto-Shipment'; // To distinguish for dialog
}

export type SubscriptionBillingFrequency = 'Monthly' | 'Quarterly' | 'Annually';

export interface SubscriptionItem {
  id: string;
  accountId: string;
  serviceName: string;
  billingFrequency: SubscriptionBillingFrequency;
  cost: number;
  nextRenewalDate: string; // ISO string;
  type: 'Subscription'; // To distinguish for dialog
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

export interface Goal {
  id: string;
  accountId: string;
  name: string;
  cost: number;
  amount: number; // Amount saved towards the goal
  link?: string | null;
}

export interface CalendarColumn {
  id: string;
  payeeId: string;
}

export interface CalendarRow {
  id: string;
  description: string;
  values: Record<string, number>; // Record<columnId, amount>
}

export interface Account {
  id: string;
  name: string;
}

export interface BudgetSubItem {
  name: string;
  amount: number;
}

export interface MonthlyBudgetItem {
    id: string;
    categoryId: string;
    budgeted: number;
    month: string; // YYYY-MM format
    breakdown?: BudgetSubItem[];
}

export type TransactionType = 'expense' | 'transfer';

export interface TransactionSplit {
    categoryId: string;
    amount: number;
    budgetItemName: string; // e.g. "London Hydro"
}

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string; // ISO string
    type: TransactionType;
    splits?: TransactionSplit[];
    transferFromId?: string;
    transferToId?: string;
}

export interface Income {
    id: string; // Will be the month string 'YYYY-MM'
    month: string;
    amount: number;
}
