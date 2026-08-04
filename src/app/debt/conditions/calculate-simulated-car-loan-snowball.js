const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');
const { format, addMonths, parse } = require('date-fns');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const privateKey = process.env.FB_PRIVATE_KEY ? process.env.FB_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;

if (!privateKey) {
  console.error("Missing FB_PRIVATE_KEY in environment");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FB_CLIENT_EMAIL,
    privateKey: privateKey,
  })
});

const db = admin.firestore();

// Implementation of the payoff logic inside the script
function simulateSchedule(debts, settings, allAdjustments, startMonthStr, extraAddInMonth17) {
  const activeDebts = debts.filter(d => !d.archived && (d.balance || 0) > 0);
  if (activeDebts.length === 0) return [];

  let currentDebts = activeDebts.map(d => ({
    id: d.id,
    name: d.name,
    balance: d.balance || 0,
    minimumPayment: d.minimumPayment || 0,
    interestRate: d.interestRate || 0,
    debtType: d.debtType || 'Credit Card'
  }));

  const schedule = [];
  let limit = 0;
  const maxMonths = 360;
  let currentMonthDate = parse(startMonthStr + '-01', 'yyyy-MM-dd', new Date());

  const strategy = settings.strategy || 'avalanche';
  const customOrder = settings.customPriorityOrder || [];

  const startingMinReq = activeDebts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
  
  while (currentDebts.length > 0 && limit < maxMonths) {
    limit++;
    const monthIndex = limit;
    const monthString = format(currentMonthDate, 'yyyy-MM');

    // Calculate baseline total monthly budget
    let monthlyBudget = Math.max(settings.totalMonthlyPayment || 0, startingMinReq);
    
    // Add car loan payment after 16 months (starts in month 17)
    if (monthIndex >= 17) {
      monthlyBudget += extraAddInMonth17;
    }

    const monthlyDetails = {};
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

    currentDebts.forEach(d => {
      const starting = d.balance;
      const rate = d.interestRate || 0;
      const interest = starting * (rate / 100) / 12;
      d.balance = starting + interest;
      
      const details = monthlyDetails[d.id];
      details.startingBalance = starting;
      details.interestAccrued = interest;
    });

    currentDebts.forEach(d => {
      const adjs = allAdjustments[d.id] || [];
      const monthAdjs = adjs.filter(a => a.month === monthString);
      let netAdjustment = 0;
      monthAdjs.forEach(a => { netAdjustment += a.amount; });
      d.balance = Math.max(0, d.balance + netAdjustment);
      monthlyDetails[d.id].adjustmentApplied = netAdjustment;
    });

    let sortedForExtra = [...currentDebts];
    if (strategy === 'avalanche') {
      sortedForExtra.sort((a, b) => b.interestRate - a.interestRate);
    } else if (strategy === 'snowball') {
      sortedForExtra.sort((a, b) => a.balance - b.balance);
    } else if (strategy === 'custom') {
      sortedForExtra.sort((a, b) => {
        const indexA = customOrder.indexOf(a.id);
        const indexB = customOrder.indexOf(b.id);
        const posA = indexA === -1 ? 9999 : indexA;
        const posB = indexB === -1 ? 9999 : indexB;
        if (posA !== posB) return posA - posB;
        return b.interestRate - a.interestRate;
      });
    }

    const monthlyPayments = {};
    let totalMinRequired = 0;
    
    currentDebts.forEach(d => {
      let minPay = d.minimumPayment;
      if (d.debtType === 'Credit Card') {
        const details = monthlyDetails[d.id];
        const interest = details.interestAccrued;
        const calcMin = Math.max(10, interest + (details.startingBalance * 0.01));
        minPay = Math.max(d.minimumPayment, calcMin);
      }
      const actualMinPay = Math.min(minPay, d.balance);
      monthlyPayments[d.id] = actualMinPay;
      totalMinRequired += actualMinPay;
    });

    let budgetForMonth = Math.max(monthlyBudget, totalMinRequired);
    
    currentDebts.forEach(d => {
      const minPay = monthlyPayments[d.id];
      d.balance -= minPay;
      budgetForMonth -= minPay;
      monthlyDetails[d.id].paymentAmount += minPay;
    });

    if (budgetForMonth > 0.01) {
      for (const priorityDebt of sortedForExtra) {
        const d = currentDebts.find(cd => cd.id === priorityDebt.id);
        if (d && d.balance > 0) {
          const extraAmount = Math.min(budgetForMonth, d.balance);
          monthlyPayments[d.id] = (monthlyPayments[d.id] || 0) + extraAmount;
          d.balance -= extraAmount;
          budgetForMonth -= extraAmount;
          monthlyDetails[d.id].paymentAmount += extraAmount;
          if (budgetForMonth <= 0.01) break;
        }
      }
    }

    const balances = {};
    const payments = {};
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
      totalPaid,
      totalInterest
    });

    currentDebts = currentDebts.filter(d => d.balance > 0.01);
    currentMonthDate = addMonths(currentMonthDate, 1);
  }

  return schedule;
}

async function run() {
  const month = '2026-08';
  
  // 1. Fetch debts
  const debtsSnap = await db.collection('debts').orderBy('order').get();
  const debts = [];
  for (const doc of debtsSnap.docs) {
    const base = doc.data();
    const monthlySnap = await doc.ref.collection('months').doc(month).get();
    if (monthlySnap.exists) {
      debts.push({ id: doc.id, ...base, ...monthlySnap.data() });
    }
  }

  // 2. Fetch settings
  const settingsDoc = await db.collection('settings').doc('debt-plan').get();
  const settings = settingsDoc.exists ? settingsDoc.data() : { strategy: 'avalanche', totalMonthlyPayment: 0 };

  // 3. Fetch adjustments
  const adjustments = {};
  for (const d of debts) {
    const adjSnap = await db.collection('debts').doc(d.id).collection('adjustments').get();
    adjustments[d.id] = adjSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  console.log(`Initial total debt balance: $${debts.reduce((sum, d) => sum + (d.balance || 0), 0).toFixed(2)}`);
  console.log(`Starting total monthly payment (minimums + extra): $${Math.max(settings.totalMonthlyPayment || 0, debts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0)).toFixed(2)}`);
  console.log(`Strategy: ${settings.strategy}\n`);

  // Scenario A: Baseline
  const baseline = simulateSchedule(debts, settings, adjustments, month, 0);
  const baselineInterest = baseline.reduce((sum, e) => sum + e.totalInterest, 0);

  // Scenario B: With Car Loan Snowball
  const extraAdd = 486.72;
  const withCarLoan = simulateSchedule(debts, settings, adjustments, month, extraAdd);
  const withCarLoanInterest = withCarLoan.reduce((sum, e) => sum + e.totalInterest, 0);

  console.log("=== SCENARIO A: BASELINE ===");
  console.log(`Payoff Speed: ${baseline.length} Months`);
  console.log(`Total Interest Paid: $${baselineInterest.toFixed(2)}`);
  if (baseline.length > 0) {
    const finalDate = addMonths(parse(month + '-01', 'yyyy-MM-dd', new Date()), baseline.length - 1);
    console.log(`Debt-Free Date: ${format(finalDate, 'MMMM yyyy')}`);
  }
  console.log("------------------------");

  console.log("=== SCENARIO B: WITH $486.72 ADDED IN MONTH 17 ===");
  console.log(`Payoff Speed: ${withCarLoan.length} Months`);
  console.log(`Total Interest Paid: $${withCarLoanInterest.toFixed(2)}`);
  if (withCarLoan.length > 0) {
    const finalDate = addMonths(parse(month + '-01', 'yyyy-MM-dd', new Date()), withCarLoan.length - 1);
    console.log(`Debt-Free Date: ${format(finalDate, 'MMMM yyyy')}`);
  }
  console.log("------------------------");

  const monthsSaved = baseline.length - withCarLoan.length;
  const interestSaved = baselineInterest - withCarLoanInterest;
  console.log(`\n★★★ SAVINGS SUMMARY ★★★`);
  console.log(`Time Saved: ${monthsSaved} Months (${(monthsSaved/12).toFixed(1)} Years)`);
  console.log(`Interest Saved: $${interestSaved.toFixed(2)}`);
}

run().catch(console.error);
