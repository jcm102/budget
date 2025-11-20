
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const SETTINGS_COLLECTION = 'settings';
const MILEAGE_RATE_DOC = 'mileageRate';
const EXCHANGE_RATE_DOC = 'exchangeRate';
const CREDIT_CARD_REPORT_DATE_DOC = 'creditCardReport';
const COMMON_ACCOUNTS_DOC = 'commonAccounts';


const DEFAULT_MILEAGE_RATE = 0.50;
const DEFAULT_EXCHANGE_RATE = 1.35;

interface MileageRateSetting {
  rate: number;
}

interface ExchangeRateSetting {
  usdToCad: number;
}

interface CreditCardReportDateSetting {
    lastRunDate: string; // Stored as 'YYYY-MM-DD'
}

interface CommonAccountsSetting {
    accountIds: string[];
}


export async function getMileageRate(): Promise<number> {
  const docRef = doc(db, SETTINGS_COLLECTION, MILEAGE_RATE_DOC);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return (docSnap.data() as MileageRateSetting).rate;
  } else {
    // If the document doesn't exist, create it with the default rate
    await setDoc(docRef, { rate: DEFAULT_MILEAGE_RATE });
    return DEFAULT_MILEAGE_RATE;
  }
}

export async function updateMileageRate(rate: number): Promise<void> {
  const docRef = doc(db, SETTINGS_COLLECTION, MILEAGE_RATE_DOC);
  await setDoc(docRef, { rate });
}

export async function getExchangeRate(): Promise<number> {
  const docRef = doc(db, SETTINGS_COLLECTION, EXCHANGE_RATE_DOC);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return (docSnap.data() as ExchangeRateSetting).usdToCad;
  } else {
    await setDoc(docRef, { usdToCad: DEFAULT_EXCHANGE_RATE });
    return DEFAULT_EXCHANGE_RATE;
  }
}

export async function updateExchangeRate(rate: number): Promise<void> {
  const docRef = doc(db, SETTINGS_COLLECTION, EXCHANGE_RATE_DOC);
  await setDoc(docRef, { usdToCad: rate });
}

export async function getCreditCardReportLastRunDate(): Promise<string | null> {
    const docRef = doc(db, SETTINGS_COLLECTION, CREDIT_CARD_REPORT_DATE_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return (docSnap.data() as CreditCardReportDateSetting).lastRunDate;
    }
    return null;
}

export async function updateCreditCardReportLastRunDate(date: string): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, CREDIT_CARD_REPORT_DATE_DOC);
    await setDoc(docRef, { lastRunDate: date });
}

export async function getCommonAccountIds(): Promise<string[]> {
    const docRef = doc(db, SETTINGS_COLLECTION, COMMON_ACCOUNTS_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return (docSnap.data() as CommonAccountsSetting).accountIds || [];
    } else {
        // Default common accounts by name
        return ['Chequing Account', 'Credit Card', 'Splitwise'];
    }
}

export async function updateCommonAccountIds(accountIds: string[]): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, COMMON_ACCOUNTS_DOC);
    await setDoc(docRef, { accountIds });
}
