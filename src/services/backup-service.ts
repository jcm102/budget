
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';

const collectionsToBackup = [
    'accounts',
    'transferees',
    'budget-categories',
    'budget-items',
    'debts',
    'expenses',
    'goals',
    'income-categories',
    'link-groups',
    'monthly-budget-items',
    'payment-calendar',
    'people',
    'sinking-funds',
    'subscriptions',
    'autoship-items',
    'tasks',
    'work-expense-categories',
];

export async function createAutomatedBackup(reason: string): Promise<string> {
    console.log(`Creating automated backup for reason: ${reason}`);
    const backupData: Record<string, any[]> = {};
    let totalDocs = 0;

    for (const collectionName of collectionsToBackup) {
        try {
            const querySnapshot = await getDocs(collection(db, collectionName));
            const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            backupData[collectionName] = docs;
            totalDocs += docs.length;
        } catch (error) {
            console.error(`Error backing up collection ${collectionName}:`, error);
            // We'll continue to back up other collections even if one fails
        }
    }

    const backupDocRef = doc(collection(db, 'backups'));
    
    await setDoc(backupDocRef, {
        reason: reason,
        createdAt: serverTimestamp(),
        data: backupData,
        totalDocs: totalDocs,
    });

    console.log(`Backup ${backupDocRef.id} created successfully with ${totalDocs} documents.`);
    return backupDocRef.id;
}

export async function getBackups() {
    const backupCollection = collection(db, 'backups');
    const q = query(backupCollection, orderBy('createdAt', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            reason: data.reason,
            createdAt: data.createdAt.toDate().toISOString(),
            totalDocs: data.totalDocs,
        };
    });
}
