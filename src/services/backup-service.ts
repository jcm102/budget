'use server';

import { db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

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
    'sinking-fund-transactions',
    'sinking-fund-categories',
    'subscriptions',
    'autoship-items',
    'settings',
    'tasks',
    'work-expense-categories',
    'transactions'
];

export async function createAutomatedBackup(reason: string): Promise<string> {
    console.log(`Creating automated backup for reason: ${reason}`);
    const backupData: Record<string, any[]> = {};
    let totalDocs = 0;

    for (const collectionName of collectionsToBackup) {
        try {
            const querySnapshot = await db.collection(collectionName).get();
            const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            backupData[collectionName] = docs;
            totalDocs += docs.length;
        } catch (error) {
            console.error(`Error backing up collection ${collectionName}:`, error);
            // We'll continue to back up other collections even if one fails
        }
    }

    const backupDocRef = db.collection('backups').doc();
    
    await backupDocRef.set({
        reason: reason,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: backupData,
        totalDocs: totalDocs,
    });

    console.log(`Backup ${backupDocRef.id} created successfully with ${totalDocs} documents.`);
    return backupDocRef.id;
}

export async function getBackups() {
    try {
        const querySnapshot = await db.collection('backups')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                reason: data.reason,
                createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                totalDocs: data.totalDocs,
            };
        });
    } catch (error) {
        console.error('Error fetching backups:', error);
        return [];
    }
}
