'use server';

import { db } from '@/lib/firebase-admin';
import type { 
  MileageRateSetting, 
  ExchangeRateSetting, 
  CreditCardReportDateSetting, 
  CommonAccountsSetting 
} from '@/types';

const SETTINGS_COLLECTION = 'settings';
const MILEAGE_RATE_DOC = 'mileageRate';
const EXCHANGE_RATE_DOC = 'exchangeRate';
const CREDIT_CARD_REPORT_DATE_DOC = 'creditCardReport';
const COMMON_ACCOUNTS_DOC = 'commonAccounts';

const DEFAULT_MILEAGE_RATE = 0.50;
const DEFAULT_EXCHANGE_RATE = 1.35;

export async function getMileageRate(): Promise<number> {
  // Admin SDK syntax: db.collection().doc().get()
  const docRef = db.collection(SETTINGS_COLLECTION).doc(MILEAGE_RATE_DOC);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return (docSnap.data() as MileageRateSetting).rate;
  } else {
    await docRef.set({ rate: DEFAULT_MILEAGE_RATE });
    return DEFAULT_MILEAGE_RATE;
  }
}

export async function updateMileageRate(rate: number): Promise<void> {
  await db.collection(SETTINGS_COLLECTION).doc(MILEAGE_RATE_DOC).set({ rate });
}

export async function getExchangeRate(): Promise<number> {
  const docRef = db.collection(SETTINGS_COLLECTION).doc(EXCHANGE_RATE_DOC);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return (docSnap.data() as ExchangeRateSetting).usdToCad;
  } else {
    await docRef.set({ usdToCad: DEFAULT_EXCHANGE_RATE });
    return DEFAULT_EXCHANGE_RATE;
  }
}

export async function updateExchangeRate(rate: number): Promise<void> {
  await db.collection(SETTINGS_COLLECTION).doc(EXCHANGE_RATE_DOC).set({ usdToCad: rate });
}

export async function getCreditCardReportLastRunDate(): Promise<string | null> {
    const docSnap = await db.collection(SETTINGS_COLLECTION).doc(CREDIT_CARD_REPORT_DATE_DOC).get();
    if (docSnap.exists) {
        return (docSnap.data() as CreditCardReportDateSetting).lastRunDate;
    }
    return null;
}

export async function updateCreditCardReportLastRunDate(date: string): Promise<void> {
    await db.collection(SETTINGS_COLLECTION).doc(CREDIT_CARD_REPORT_DATE_DOC).set({ lastRunDate: date });
}

export async function getCommonAccountIds(): Promise<string[]> {
    const docSnap = await db.collection(SETTINGS_COLLECTION).doc(COMMON_ACCOUNTS_DOC).get();
    if (docSnap.exists) {
        return (docSnap.data() as CommonAccountsSetting).accountIds || [];
    } else {
        return ['Chequing Account', 'Credit Card', 'Splitwise'];
    }
}

export async function updateCommonAccountIds(accountIds: string[]): Promise<void> {
    await db.collection(SETTINGS_COLLECTION).doc(COMMON_ACCOUNTS_DOC).set({ accountIds });
}