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
    'payees',
    'account-ledger-items',
    'sinking-funds',
    'sinking-fund-transactions',
    'sinking-fund-categories',
    'subscriptions',
    'autoship-items',
    'settings',
    'tasks',
    'work-expense-categories',
    'honorariums',
    'mileage-logs',
    'transactions'
];

export interface BackupSummary {
    id: string;
    reason: string;
    createdAt: string;
    totalDocs: number;
}

export interface FreshStartOptions {
    resetSinkingFunds?: boolean;
    resetCompletedOverviewItems?: boolean;
    initialBalances?: Record<string, number>;
    customBackupReason?: string;
}

/**
 * Batch writer helper to respect Firestore's 500-operation transaction/batch limit
 */
class BatchWriter {
    private currentBatch: admin.firestore.WriteBatch;
    private count = 0;
    private total = 0;

    constructor() {
        this.currentBatch = db.batch();
    }

    async set(ref: admin.firestore.DocumentReference, data: any, options?: admin.firestore.SetOptions) {
        if (options) {
            this.currentBatch.set(ref, data, options);
        } else {
            this.currentBatch.set(ref, data);
        }
        this.count++;
        this.total++;
        if (this.count >= 400) {
            await this.currentBatch.commit();
            this.currentBatch = db.batch();
            this.count = 0;
        }
    }

    async update(ref: admin.firestore.DocumentReference, data: any) {
        this.currentBatch.update(ref, data);
        this.count++;
        this.total++;
        if (this.count >= 400) {
            await this.currentBatch.commit();
            this.currentBatch = db.batch();
            this.count = 0;
        }
    }

    async delete(ref: admin.firestore.DocumentReference) {
        this.currentBatch.delete(ref);
        this.count++;
        this.total++;
        if (this.count >= 400) {
            await this.currentBatch.commit();
            this.currentBatch = db.batch();
            this.count = 0;
        }
    }

    async commit() {
        if (this.count > 0) {
            await this.currentBatch.commit();
            this.currentBatch = db.batch();
            this.count = 0;
        }
        return this.total;
    }
}

/**
 * Converts serialized timestamp objects {_seconds, _nanoseconds} back to Firestore Timestamp instances.
 */
function restoreTimestamps(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
        return obj.map(restoreTimestamps);
    }
    if (typeof obj === 'object') {
        if (typeof obj._seconds === 'number' && typeof obj._nanoseconds === 'number') {
            return new admin.firestore.Timestamp(obj._seconds, obj._nanoseconds);
        }
        const result: Record<string, any> = {};
        for (const key of Object.keys(obj)) {
            result[key] = restoreTimestamps(obj[key]);
        }
        return result;
    }
    return obj;
}

/**
 * Creates a comprehensive backup of all database collections,
 * including debt subcollections ('months' and 'adjustments').
 */
export async function createAutomatedBackup(reason: string): Promise<string> {
    console.log(`[BackupService] Creating automated backup: "${reason}"`);
    const backupData: Record<string, any[]> = {};
    let totalDocs = 0;

    for (const collectionName of collectionsToBackup) {
        try {
            const querySnapshot = await db.collection(collectionName).get();
            
            if (collectionName === 'debts') {
                const docs: any[] = [];
                for (const doc of querySnapshot.docs) {
                    const debtData: any = { id: doc.id, ...doc.data() };
                    
                    // Backup 'months' subcollection
                    try {
                        const monthsSnap = await doc.ref.collection('months').get();
                        if (!monthsSnap.empty) {
                            debtData._months = monthsSnap.docs.map(m => ({ id: m.id, ...m.data() }));
                            totalDocs += monthsSnap.size;
                        }
                    } catch (e) {
                        console.error(`Error backing up months for debt ${doc.id}:`, e);
                    }

                    // Backup 'adjustments' subcollection
                    try {
                        const adjSnap = await doc.ref.collection('adjustments').get();
                        if (!adjSnap.empty) {
                            debtData._adjustments = adjSnap.docs.map(a => ({ id: a.id, ...a.data() }));
                            totalDocs += adjSnap.size;
                        }
                    } catch (e) {
                        console.error(`Error backing up adjustments for debt ${doc.id}:`, e);
                    }

                    docs.push(debtData);
                }
                backupData[collectionName] = docs;
                totalDocs += docs.length;
            } else {
                const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                backupData[collectionName] = docs;
                totalDocs += docs.length;
            }
        } catch (error) {
            console.error(`Error backing up collection ${collectionName}:`, error);
        }
    }

    const backupDocRef = db.collection('backups').doc();
    
    await backupDocRef.set({
        reason: reason,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: backupData,
        totalDocs: totalDocs,
    });

    console.log(`[BackupService] Backup ${backupDocRef.id} created successfully with ${totalDocs} documents.`);
    return backupDocRef.id;
}

/**
 * Returns list of backups with metadata (ordered newest first).
 */
export async function getBackups(): Promise<BackupSummary[]> {
    try {
        const querySnapshot = await db.collection('backups')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            let createdAtIso = new Date().toISOString();
            if (data.createdAt) {
                if (typeof data.createdAt.toDate === 'function') {
                    createdAtIso = data.createdAt.toDate().toISOString();
                } else if (typeof data.createdAt === 'string') {
                    createdAtIso = data.createdAt;
                }
            }
            return {
                id: doc.id,
                reason: data.reason || 'Automated Backup',
                createdAt: createdAtIso,
                totalDocs: data.totalDocs || 0,
            };
        });
    } catch (error) {
        console.error('Error fetching backups:', error);
        return [];
    }
}

/**
 * Fetches document count per collection in a specific backup.
 */
export async function getBackupDetails(backupId: string): Promise<Record<string, number> | null> {
    try {
        const docSnap = await db.collection('backups').doc(backupId).get();
        if (!docSnap.exists) return null;
        const data = docSnap.data()?.data || {};
        const breakdown: Record<string, number> = {};
        for (const col of Object.keys(data)) {
            breakdown[col] = Array.isArray(data[col]) ? data[col].length : 0;
        }
        return breakdown;
    } catch (error) {
        console.error(`Error fetching backup details for ${backupId}:`, error);
        return null;
    }
}

/**
 * Restores the entire database from a selected backup.
 * Takes a safety backup of the current database before restoring!
 */
export async function restoreBackup(backupId: string): Promise<{
    success: boolean;
    message: string;
    restoredDocs: number;
    safetyBackupId: string;
}> {
    console.log(`[BackupService] Starting restoration of backup: ${backupId}`);
    const backupDoc = await db.collection('backups').doc(backupId).get();
    if (!backupDoc.exists) {
        throw new Error(`Backup with ID ${backupId} not found.`);
    }

    const backupRecord = backupDoc.data();
    const backupData: Record<string, any[]> = backupRecord?.data || {};
    const backupReason = backupRecord?.reason || backupId;

    // Step 1: Create a safety backup of the current state before overwriting
    const safetyBackupId = await createAutomatedBackup(`pre-restore-safety-snapshot (Restoring: ${backupReason})`);
    console.log(`[BackupService] Pre-restore safety backup created: ${safetyBackupId}`);

    const batchWriter = new BatchWriter();

    // Step 2: Clear existing data across the collections
    console.log('[BackupService] Clearing existing data...');
    for (const collectionName of collectionsToBackup) {
        if (collectionName === 'debts') {
            const existingDebts = await db.collection('debts').get();
            for (const debtDoc of existingDebts.docs) {
                const months = await debtDoc.ref.collection('months').get();
                for (const m of months.docs) {
                    await batchWriter.delete(m.ref);
                }
                const adjustments = await debtDoc.ref.collection('adjustments').get();
                for (const a of adjustments.docs) {
                    await batchWriter.delete(a.ref);
                }
                await batchWriter.delete(debtDoc.ref);
            }
        } else {
            const snapshot = await db.collection(collectionName).get();
            for (const doc of snapshot.docs) {
                await batchWriter.delete(doc.ref);
            }
        }
    }
    await batchWriter.commit();
    console.log('[BackupService] Existing data cleared.');

    // Step 3: Restore data from backup
    let totalDocsRestored = 0;
    console.log('[BackupService] Writing restored documents...');

    for (const collectionName of Object.keys(backupData)) {
        const documents = backupData[collectionName];
        if (!Array.isArray(documents)) continue;

        if (collectionName === 'debts') {
            for (const docData of documents) {
                const { id, _months, _adjustments, ...data } = docData;
                if (!id) continue;

                const debtRef = db.collection('debts').doc(id);
                await batchWriter.set(debtRef, restoreTimestamps(data));
                totalDocsRestored++;

                if (Array.isArray(_months)) {
                    for (const m of _months) {
                        const { id: mId, ...mData } = m;
                        if (mId) {
                            await batchWriter.set(debtRef.collection('months').doc(mId), restoreTimestamps(mData));
                            totalDocsRestored++;
                        }
                    }
                }

                if (Array.isArray(_adjustments)) {
                    for (const a of _adjustments) {
                        const { id: aId, ...aData } = a;
                        if (aId) {
                            await batchWriter.set(debtRef.collection('adjustments').doc(aId), restoreTimestamps(aData));
                            totalDocsRestored++;
                        }
                    }
                }
            }
        } else {
            for (const docData of documents) {
                const { id, ...data } = docData;
                if (!id) continue;
                const docRef = db.collection(collectionName).doc(id);
                await batchWriter.set(docRef, restoreTimestamps(data));
                totalDocsRestored++;
            }
        }
    }

    await batchWriter.commit();
    console.log(`[BackupService] Restoration complete: restored ${totalDocsRestored} documents.`);

    return {
        success: true,
        message: `Successfully restored backup "${backupReason}" (${totalDocsRestored} items).`,
        restoredDocs: totalDocsRestored,
        safetyBackupId,
    };
}

/**
 * Deletes a single backup by ID.
 */
export async function deleteBackup(backupId: string): Promise<{ success: boolean; message: string }> {
    await db.collection('backups').doc(backupId).delete();
    return { success: true, message: 'Backup deleted successfully.' };
}

/**
 * Resets all account balances, clears out the transaction ledger,
 * while strictly retaining the debt payment sheet and monthly budget templates.
 * Also creates an automated backup prior to any modification.
 */
export async function resetForFreshStart(options: FreshStartOptions = {}): Promise<{
    success: boolean;
    backupId: string;
    message: string;
    accountsReset: number;
    transactionsCleared: number;
}> {
    console.log('[BackupService] Starting Fresh Start reset...');

    // 1. Mandatory Safety Backup
    const backupReason = options.customBackupReason || `Pre-Fresh Start (${new Date().toLocaleString()})`;
    const backupId = await createAutomatedBackup(backupReason);
    console.log(`[BackupService] Pre-fresh-start safety backup saved as ${backupId}`);

    const batchWriter = new BatchWriter();

    // 2. Reset Account Balances (transferees)
    const accountsSnap = await db.collection('transferees').get();
    let accountsReset = 0;
    for (const doc of accountsSnap.docs) {
        const initialBal = (options.initialBalances && options.initialBalances[doc.id] !== undefined)
            ? Number(options.initialBalances[doc.id])
            : 0;
        await batchWriter.update(doc.ref, { balance: initialBal });
        accountsReset++;
    }

    // 3. Clear Account Ledger Items (for calculated accounts)
    const ledgerSnap = await db.collection('account-ledger-items').get();
    for (const doc of ledgerSnap.docs) {
        await batchWriter.delete(doc.ref);
    }

    // 4. Clear Transaction Ledger (transactions)
    const txSnap = await db.collection('transactions').get();
    const transactionsCleared = txSnap.size;
    for (const doc of txSnap.docs) {
        await batchWriter.delete(doc.ref);
    }

    // 5. Reset Sinking Funds balances & transactions (if requested, default true)
    if (options.resetSinkingFunds !== false) {
        const sfSnap = await db.collection('sinking-funds').get();
        for (const doc of sfSnap.docs) {
            await batchWriter.update(doc.ref, { amount: 0 });
        }
        const sfTxSnap = await db.collection('sinking-fund-transactions').get();
        for (const doc of sfTxSnap.docs) {
            await batchWriter.delete(doc.ref);
        }
    }

    // 6. Reset Recurring Budget Overview one-time completed override items (if requested, default true)
    if (options.resetCompletedOverviewItems !== false) {
        const budgetItemsSnap = await db.collection('budget-items').get();
        for (const doc of budgetItemsSnap.docs) {
            const data = doc.data();
            // Items with originalId are monthly overrides / completed instances
            if (data.originalId) {
                await batchWriter.delete(doc.ref);
            }
        }
    }

    // 7. Commit all reset operations
    await batchWriter.commit();

    // Notice that:
    // - 'debts' and its subcollections ('months', 'adjustments') are UNTOUCHED!
    // - 'monthly-budget-items' (budgeted amounts & breakdowns) are UNTOUCHED!
    // - 'budget-categories' are UNTOUCHED!
    // - Base 'budget-items' recurring templates (!originalId) are UNTOUCHED!
    // - All account definitions, categories, payees, people, settings are UNTOUCHED!

    console.log(`[BackupService] Fresh start complete. Reset ${accountsReset} accounts, cleared ${transactionsCleared} transactions.`);

    return {
        success: true,
        backupId,
        accountsReset,
        transactionsCleared,
        message: `Fresh start completed successfully! Reset ${accountsReset} accounts and cleared ${transactionsCleared} transactions. Safety backup saved as "${backupReason}".`,
    };
}
