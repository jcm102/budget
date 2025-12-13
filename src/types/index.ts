

export type TaskFrequency = "daily" | "weekly" | "monthly";

export const internalPages = [
  { name: 'Debt Worksheet', path: '/debt' },
  { name: 'Budget Overview', path: '/budget' },
  { name: 'Work Expenses', path: '/expenses' },
  { name: 'Future Spending', path: '/savings' },
  { name: 'Reports', path: '/reports' },
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
  destinationAccountId?: string | null;
  originalId?: string; // To track edited recurring instances
  completed?: boolean;
  allocationType?: 'none' | 'goal' | 'debt';
  allocationTargetId?: string;
  allocationAmount?: number;
  forNextMonth?: boolean;
  budgetCategoryId?: string | null; // New field to link to a budget category
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
    isCalculated?: boolean;
}


export type ExpenseType = 'Monetary' | 'Mileage' | 'Honorarium';

interface BaseExpense {
  id: string;
  type: ExpenseType;
  description: string;
  date: string; // ISO string
  status: 'active' | 'archived';
  archiveKey?: string; // e.g., '2024-08'
  forNextMonth?: boolean;
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
  receiptUrl?: string | null;
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

export type SavingsRecurrence = 'None' | 'Quarterly' | 'Semi-Annually' | 'Annually' | 'Bi-Annually' | 'Semi-Annually (Custom)';

export interface SavingsItem {
  id: string;
  accountId: string;
  name: string;
  amount: number;
  currency: 'CAD' | 'USD';
  goal?: number | null; // Monthly contribution goal
  isCustomGoal?: boolean;
  totalCost?: number | null; // Optional total cost for the fund
  dueDate?: string | null; // Optional due date for the fund
  recurrence?: SavingsRecurrence | null;
  primaryPaymentMonth?: number | null; // For "Semi-Annually (Custom)"
  secondaryPaymentMonth?: number | null; // For "Semi-Annually (Custom)"
  parentId?: string | null;
  monthlyAmount?: number; // Calculated field
  lastFundedAt?: string | null; // ISO string
  categoryId?: string | null;
}

export interface SinkingFundTransaction {
  id: string;
  fundId: string;
  amount: number;
  type: 'deposit' | 'withdraw' | 'reset';
  date: string; // ISO string
  notes?: string;
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
    budgetCategoryId?: string;
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
  budgetCategoryId?: string;
  includeInSinkingFund?: boolean;
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
    month: string; // YYYY-MM
    breakdown?: BudgetSubItem[];
}

export interface TransactionSplit {
    id: string; // A unique ID for the split itself
    type: 'expense' | 'transfer';
    amount: number;
    
    // An expense against a category
    categoryId?: string;
    budgetItemName?: string;
    
    // A transfer to another account
    destinationAccountId?: string;
}

export interface Transaction {
    id: string;
    description: string;
    amount: number; // The total amount of the transaction
    date: string; // ISO string
    sourceAccountId?: string; // The account the money came from
    paidById?: string; // Used when another person pays (IOU)
    splits: TransactionSplit[];
}


export interface Income {
    id: string; // Will be the month string 'YYYY-MM'
    month: string;
    amount: number;
}
