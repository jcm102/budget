import type { Debt, DebtPlanSettings, PlannedAdjustment } from '@/types';
import { format, addMonths, parse } from 'date-fns';

export interface ScheduleMonthlyBalance {
  debtId: string;
  startingBalance: number;
  interestAccrued: number;
  adjustmentApplied: number;
  paymentAmount: number;
  endingBalance: number;
}

export interface ScheduleEntry {
  month: number;
  monthString: string; // e.g. "2026-08"
  payments: Record<string, number>; // debtId -> payment
  balances: Record<string, number>; // debtId -> ending balance
  details: Record<string, ScheduleMonthlyBalance>; // debtId -> details
  totalPaid: number;
  totalInterest: number;
}

export function calculatePayoffSchedule(
  debts: Debt[],
  settings: DebtPlanSettings,
  allAdjustments: Record<string, PlannedAdjustment[]>,
  startMonthStr: string
): ScheduleEntry[] {
  const activeDebts = debts.filter(d => !d.archived && (d.balance || 0) > 0);
  if (activeDebts.length === 0) return [];

  // Initialize projection state
  let currentDebts = activeDebts.map(d => ({
    id: d.id,
    name: d.name,
    balance: d.balance || 0,
    minimumPayment: d.minimumPayment || 0,
    interestRate: d.interestRate || 0,
    debtType: d.debtType || 'Credit Card'
  }));

  const schedule: ScheduleEntry[] = [];
  let limit = 0;
  const maxMonths = 360; // 30 years safety cap
  let currentMonthDate = parse(startMonthStr + '-01', 'yyyy-MM-dd', new Date());

  // Payoff strategy configuration
  const strategy = settings.strategy || 'avalanche';
  const customOrder = settings.customPriorityOrder || [];

  const startingMinReq = activeDebts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
  const totalMonthlyBudget = Math.max(settings.totalMonthlyPayment || 0, startingMinReq);

  while (currentDebts.length > 0 && limit < maxMonths) {
    limit++;
    const monthIndex = limit;
    const monthString = format(currentMonthDate, 'yyyy-MM');

    // 1. Initialize details for ALL active debts to avoid undefined crashes
    const monthlyDetails: Record<string, ScheduleMonthlyBalance> = {};
    activeDebts.forEach(d => {
      monthlyDetails[d.id] = {
        debtId: d.id,
        startingBalance: 0,
        interestAccrued: 0,
        adjustmentApplied: 0,
        paymentAmount: 0,
        endingBalance: 0
      };
    });

    // 2. Accrue interest on all starting balances for debts that are STILL active
    currentDebts.forEach(d => {
      const starting = d.balance;
      const rate = d.interestRate || 0;
      const interest = starting * (rate / 100) / 12;
      
      // Keep track of state
      d.balance = starting + interest;
      
      const details = monthlyDetails[d.id];
      details.startingBalance = starting;
      details.interestAccrued = interest;
    });

    // 3. Apply any planned adjustments/overrides for this month (charges, fees, extra windfalls)
    currentDebts.forEach(d => {
      const adjs = allAdjustments[d.id] || [];
      const monthAdjs = adjs.filter(a => a.month === monthString);
      let netAdjustment = 0;
      
      monthAdjs.forEach(a => {
        netAdjustment += a.amount; // Positive for charges, negative for windfalls
      });
      
      d.balance = Math.max(0, d.balance + netAdjustment);
      monthlyDetails[d.id].adjustmentApplied = netAdjustment;
    });

    // Sort debts for extra payment priority
    let sortedForExtra = [...currentDebts];
    if (strategy === 'avalanche') {
      // Avalanche: Highest interest first
      sortedForExtra.sort((a, b) => b.interestRate - a.interestRate);
    } else if (strategy === 'snowball') {
      // Snowball: Lowest balance first
      sortedForExtra.sort((a, b) => a.balance - b.balance);
    } else if (strategy === 'custom') {
      // Custom: User-defined order
      sortedForExtra.sort((a, b) => {
        const indexA = customOrder.indexOf(a.id);
        const indexB = customOrder.indexOf(b.id);
        const posA = indexA === -1 ? 9999 : indexA;
        const posB = indexB === -1 ? 9999 : indexB;
        if (posA !== posB) return posA - posB;
        // Fallback to highest interest
        return b.interestRate - a.interestRate;
      });
    }

    // 4. Determine the dynamic minimum payments for this month
    const monthlyPayments: Record<string, number> = {};
    let totalMinRequired = 0;
    
    currentDebts.forEach(d => {
      let minPay = d.minimumPayment;
      
      // Calculate dynamic minimum payment if it's a credit card
      if (d.debtType === 'Credit Card') {
        const details = monthlyDetails[d.id];
        const interest = details.interestAccrued;
        // Credit card min: max of $10 or (interest + 1% of principal balance)
        const calcMin = Math.max(10, interest + (details.startingBalance * 0.01));
        // Use user's input minPay as baseline/override if larger, or fallback to calculation
        minPay = Math.max(d.minimumPayment, calcMin);
      }
      
      // Don't pay more than the outstanding balance
      const actualMinPay = Math.min(minPay, d.balance);
      monthlyPayments[d.id] = actualMinPay;
      totalMinRequired += actualMinPay;
    });

    // Calculate total budget available for this month
    // The budget is kept constant at the initial total monthly budget (starting minimums + extra pool)
    let budgetForMonth = Math.max(totalMonthlyBudget, totalMinRequired);
    
    // Step A: Pay all minimum payments first
    currentDebts.forEach(d => {
      const minPay = monthlyPayments[d.id];
      d.balance -= minPay;
      budgetForMonth -= minPay;
      monthlyDetails[d.id].paymentAmount += minPay;
    });

    // Step B: Distribute the remaining budget to the highest priority debt(s)
    if (budgetForMonth > 0.01) {
      for (const priorityDebt of sortedForExtra) {
        const d = currentDebts.find(cd => cd.id === priorityDebt.id)!;
        if (d.balance > 0) {
          const extraAmount = Math.min(budgetForMonth, d.balance);
          monthlyPayments[d.id] += extraAmount;
          d.balance -= extraAmount;
          budgetForMonth -= extraAmount;
          monthlyDetails[d.id].paymentAmount += extraAmount;
          if (budgetForMonth <= 0.01) break;
        }
      }
    }

    // Finalize ending balances and record entries
    const balances: Record<string, number> = {};
    const payments: Record<string, number> = {};
    let totalPaid = 0;
    let totalInterest = 0;

    activeDebts.forEach(d => {
      const details = monthlyDetails[d.id];
      const ending = currentDebts.find(cd => cd.id === d.id)?.balance ?? 0;
      
      details.endingBalance = ending;
      balances[d.id] = ending;
      payments[d.id] = details.paymentAmount;
      totalPaid += details.paymentAmount;
      totalInterest += details.interestAccrued;
    });

    schedule.push({
      month: monthIndex,
      monthString,
      payments,
      balances,
      details: monthlyDetails,
      totalPaid,
      totalInterest
    });

    // Remove paid off debts from active list
    currentDebts = currentDebts.filter(d => d.balance > 0.01);
    
    // Increment month
    currentMonthDate = addMonths(currentMonthDate, 1);
  }

  return schedule;
}
