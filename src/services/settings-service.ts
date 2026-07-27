'use server';

import { db } from '@/lib/firebase-admin';

const SETTINGS_COLLECTION = 'settings';
const EXCHANGE_RATE_DOC = 'exchange-rates';
const MILEAGE_RATE_DOC = 'mileage-rates';
const REPORTS_DOC = 'reports-config';
const COMMON_ACCOUNTS_DOC = 'common-accounts';

export async function getExchangeRate(): Promise<number> {
  const doc = await db.collection(SETTINGS_COLLECTION).doc(EXCHANGE_RATE_DOC).get();
  return doc.exists ? doc.data()?.usdToCad || 1.35 : 1.35;
}

export async function updateExchangeRate(rate: number): Promise<void> {
  await db.collection(SETTINGS_COLLECTION).doc(EXCHANGE_RATE_DOC).set({
    usdToCad: rate,
    lastUpdated: new Date().toISOString()
  }, { merge: true });
}

export async function getMileageRate(): Promise<number> {
  const doc = await db.collection(SETTINGS_COLLECTION).doc(MILEAGE_RATE_DOC).get();
  return doc.exists ? doc.data()?.rate || 0.65 : 0.65;
}

export async function updateMileageRate(rate: number): Promise<void> {
  await db.collection(SETTINGS_COLLECTION).doc(MILEAGE_RATE_DOC).set({
    rate,
    lastUpdated: new Date().toISOString()
  }, { merge: true });
}

export async function getCreditCardReportLastRunDate(): Promise<string | null> {
  const doc = await db.collection(SETTINGS_COLLECTION).doc(REPORTS_DOC).get();
  return doc.exists ? doc.data()?.ccReportLastRun || null : null;
}

export async function updateCreditCardReportLastRunDate(date: string): Promise<void> {
  await db.collection(SETTINGS_COLLECTION).doc(REPORTS_DOC).set({
    ccReportLastRun: date
  }, { merge: true });
}

export async function getCommonAccountIds(): Promise<string[]> {
  const doc = await db.collection(SETTINGS_COLLECTION).doc(COMMON_ACCOUNTS_DOC).get();
  return doc.exists ? (doc.data()?.accountIds as string[]) || [] : [];
}

export async function updateCommonAccountIds(ids: string[]): Promise<void> {
  await db.collection(SETTINGS_COLLECTION).doc(COMMON_ACCOUNTS_DOC).set(
    { accountIds: ids },
    { merge: true }
  );
}