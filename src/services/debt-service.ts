

'use server';

import { db } from '@/lib/firebase';
import type { Debt, AccountDetails, BudgetItem, Category, DebtType, MonthlyBudgetItem } from '@/types';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  query,
  writeBatch,
  getDoc,
  orderBy,
  updateDoc,
  runTransaction,
  where
} from 'firebase/firestore';

const DEBT_COLLECTION = 'debts';
const ACCOUNT_DETAILS_COLLECTION = 'transferees';
const TRANSACTIONS_COLLECTION = 'transactions';
const BUDGET_CATEGORIES_COLLECTION = 'budget-categories';
const BUDGET_ITEMS_COLLECTION = 'budget-items';
const MONTHLY_BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';


export async function getDebts(): Promise<Debt[]> {
  const debtCollection = collection(db, DEBT_COLLECTION);
  const q = query(debtCollection, orderBy('order'));
  const querySnapshot = await getDocs(q);
  const debts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));
  return debts;
}

export async function addDebt(debtData: Omit<Debt, 'id' | 'order'>): Promise<Debt> {
  const debtCollectionRef = collection(db, DEBT_COLLECTION);
  const snapshot = await getDocs(query(debtCollectionRef));
  const newOrder = snapshot.size;

  const newDebt: Omit<Debt, 'id'> = { 
    ...debtData, 
    interestRate: debtData.interestRate || 0,
    debtType: debtData.debtType || 'Credit Card',
    order: newOrder, 
    paid: false,
    nextBalance: debtData.nextBalance || 0,
    nextMinimumPayment: debtData.nextMinimumPayment || 0,
    nextDueDate: debtData.nextDueDate,
    nextPaid: false,
    actualPayment: debtData.actualPayment || 0,
   };
  const docRef = doc(collection(db, DEBT_COLLECTION));
  await setDoc(docRef, newDebt);
  return { ...newDebt, id: docRef.id };
}

export async function updateDebt(id: string, debtData: Partial<Omit<Debt, 'id' | 'order'>>): Promise<void> {
  const debtRef = doc(db, DEBT_COLLECTION, id);
  const docSnap = await getDoc(debtRef);

  if (docSnap.exists()) {
    await updateDoc(debtRef, debtData);
  } else {
    console.warn(`Attempted to update a debt document that does not exist: ${id}`);
  }
}

export async function addExtraPayment(id: string, amount: number): Promise<void> {
  const debtRef = doc(db, DEBT_COLLECTION, id);
  await runTransaction(db, async (transaction) => {
    const debtDoc = await transaction.get(debtRef);
    if (!debtDoc.exists()) {
      throw "Debt document does not exist!";
    }
    const currentPayment = debtDoc.data().actualPayment || 0;
    const newActualPayment = currentPayment + amount;
    transaction.update(debtRef, { actualPayment: newActualPayment });
  });
}

export async function updateDebtOrder(debts: Debt[]): Promise<void> {
    const batch = writeBatch(db);
    debts.forEach((debt, index) => {
        const debtRef = doc(db, DEBT_COLLECTION, debt.id);
        batch.update(debtRef, { order: index });
    });
    await batch.commit();
}

export async function deleteDebt(id: string): Promise<void> {
  const debtRef = doc(db, DEBT_COLLECTION, id);
  await deleteDoc(debtRef);
}

export async function resetDebtValues(): Promise<void> {
  const debtCollection = collection(db, DEBT_COLLECTION);
  const q = query(debtCollection);
  const querySnapshot = await getDocs(q);
  const batch = writeBatch(db);

  querySnapshot.forEach(docSnap => {
    const debtRef = doc(db, DEBT_COLLECTION, docSnap.id);
    const updatedData = {
        balance: 0,
        minimumPayment: 0,
        actualPayment: 0,
        dueDate: new Date().toISOString(),
        paid: false,
        nextBalance: 0,
        nextMinimumPayment: 0,
        nextDueDate: new Date().toISOString(),
        nextPaid: false,
    };
    batch.update(debtRef, updatedData);
  });

  await batch.commit();
}


export async function cycleToNextMonth(): Promise<void> {
    const debtCollection = collection(db, DEBT_COLLECTION);
    const q = query(debtCollection);
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);

    querySnapshot.forEach(docSnap => {
        const debtRef = doc(db, DEBT_COLLECTION, docSnap.id);
        const debt = docSnap.data() as Debt;

        const updatedData = {
            // Move next month's data to current month
            balance: debt.nextBalance || 0,
            minimumPayment: debt.nextMinimumPayment || 0,
            actualPayment: 0, // Reset actual payment for the new month
            dueDate: debt.nextDueDate || new Date().toISOString(),
            paid: false,

            // Reset next month's data
            nextBalance: 0,
            nextMinimumPayment: 0,
            nextDueDate: new Date().toISOString(),
            nextPaid: false
        };
        batch.update(debtRef, updatedData);
    });

    await batch.commit();
}

const getBudgetCategories = async (): Promise<Category[]> => {
    const q = query(collection(db, BUDGET_CATEGORIES_COLLECTION));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
};

const getCategoryForDebt = (debtType: DebtType, budgetCategories: Category[]): Category | undefined => {
    const typeToCategoryName: Record<DebtType, string> = {
        'Credit Card': 'Credit Cards',
        'Loan': 'Loans',
        'Line of Credit': 'Line of Credit'
    };
    const categoryName = typeToCategoryName[debtType];
    return budgetCategories.find(c => c.name === categoryName);
}


export async function applyPaymentsToBudget(payments: Record<string, number>): Promise<void> {
    const batch = writeBatch(db);
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Step 1: Read all necessary data
    const [debtsSnapshot, accountsSnapshot, budgetCategories, monthlyBudgetSnapshot] = await Promise.all([
        getDocs(query(collection(db, DEBT_COLLECTION))),
        getDocs(query(collection(db, ACCOUNT_DETAILS_COLLECTION))),
        getBudgetCategories(),
        getDocs(query(collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION), where('month', '==', currentMonth)))
    ]);
    const allDebts = debtsSnapshot.docs.map(d => ({id: d.id, ...d.data()} as Debt));
    const allAccounts = accountsSnapshot.docs.map(a => ({id: a.id, ...a.data()} as AccountDetails));
    const allMonthlyBudgetItems = monthlyBudgetSnapshot.docs.map(d => ({id: d.id, ...d.data()} as MonthlyBudgetItem));

    // Step 2: Clear existing debt payments from budget overview
    const existingBudgetPaymentsQuery = query(collection(db, BUDGET_ITEMS_COLLECTION), where('type', '==', 'Debt Payments'));
    const existingBudgetPaymentsSnapshot = await getDocs(existingBudgetPaymentsQuery);
    existingBudgetPaymentsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    // Aggregate payments by category
    const categoryTotals: Record<string, number> = {};

    // Step 3: Process new payments
    for (const debtId in payments) {
        const paymentAmount = payments[debtId];
        const debt = allDebts.find(d => d.id === debtId);
        
        if (!debt || paymentAmount <= 0) {
            continue;
        }

        // Update the 'actualPayment' on the debt item
        const debtRef = doc(db, DEBT_COLLECTION, debtId);
        batch.update(debtRef, { actualPayment: paymentAmount });
        
        const linkedAccount = allAccounts.find(acc => acc.linkedDebtId === debt.id);

        // Create a new budget item for the budget overview
        const budgetItemData: Omit<BudgetItem, 'id'> = {
            type: 'Debt Payments',
            description: debt.name,
            amount: paymentAmount,
            date: debt.dueDate,
            frequency: 'One-Time',
            category: 'N/A',
            completed: false,
            transferFrom: linkedAccount ? linkedAccount.name : 'Unknown',
        };
        const newBudgetItemRef = doc(collection(db, BUDGET_ITEMS_COLLECTION));
        batch.set(newBudgetItemRef, budgetItemData);

        // Aggregate payments for the monthly budget
        const debtCategory = debt.debtType ? getCategoryForDebt(debt.debtType, budgetCategories) : undefined;
        if (debtCategory) {
            if (!categoryTotals[debtCategory.id]) {
                categoryTotals[debtCategory.id] = 0;
            }
            categoryTotals[debtCategory.id] += paymentAmount;
        }
    }

     // Step 4: Update the monthly budget items with aggregated totals
    for (const categoryId in categoryTotals) {
        const totalForCategory = categoryTotals[categoryId];
        const budgetItem = allMonthlyBudgetItems.find(item => item.categoryId === categoryId);

        if (budgetItem) {
            // If item exists, update its budget
            const budgetItemRef = doc(db, MONTHLY_BUDGET_ITEMS_COLLECTION, budgetItem.id);
            batch.update(budgetItemRef, { budgeted: totalForCategory, breakdown: [] }); // Reset breakdown
        } else {
            // If item doesn't exist, create it
            const newMonthlyBudgetItemRef = doc(collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION));
            batch.set(newMonthlyBudgetItemRef, {
                categoryId: categoryId,
                month: currentMonth,
                budgeted: totalForCategory,
                breakdown: [] // Start with an empty breakdown
            });
        }
    }
    
    // Step 5: Commit all changes
    await batch.commit();
}
