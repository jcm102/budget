
'use server';

import { db } from '@/lib/firebase';
import type { Income } from '@/types';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const INCOME_COLLECTION = 'income';

export async function getIncomeForMonth(month: string): Promise<Income | null> {
  const docRef = doc(db, INCOME_COLLECTION, month);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...(docSnap.data() as Omit<Income, 'id'>) };
  } else {
    // If no income is set for the month, return a default object.
    return { id: month, month, amount: 0 };
  }
}

export async function setIncomeForMonth(month: string, amount: number): Promise<Income> {
  const docRef = doc(db, INCOME_COLLECTION, month);
  const incomeData: Omit<Income, 'id'> = { month, amount };
  await setDoc(docRef, incomeData);
  return { id: month, ...incomeData };
}
