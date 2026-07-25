'use server';

import { db } from '@/lib/firebase-admin';
import type { MileageLog } from '@/types';

const MILEAGE_COLLECTION = 'mileage-logs';

export async function getMileageLogs(status: string = 'active'): Promise<MileageLog[]> {
  try {
    const snapshot = await db.collection(MILEAGE_COLLECTION)
      .where('status', '==', status)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MileageLog));
  } catch (error) {
    console.error('Error fetching mileage logs:', error);
    return [];
  }
}

export async function addMileageLog(data: any): Promise<void> {
  await db.collection(MILEAGE_COLLECTION).add({
    ...data,
    status: 'active',
    createdAt: new Date().toISOString()
  });
}

export async function updateMileageLog(id: string, data: any): Promise<void> {
  await db.collection(MILEAGE_COLLECTION).doc(id).update(data);
}

export async function deleteMileageLog(id: string): Promise<void> {
  await db.collection(MILEAGE_COLLECTION).doc(id).delete();
}