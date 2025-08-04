'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const SETTINGS_COLLECTION = 'settings';
const MILEAGE_RATE_DOC = 'mileageRate';
const DEFAULT_MILEAGE_RATE = 0.50;

interface MileageRateSetting {
  rate: number;
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
