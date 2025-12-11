// To run this script, use: npx tsx ./scripts/backup.ts

import * as fs from 'fs';
import { db } from '../src/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

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

async function backupData() {
    console.log('Starting data backup...');
    const backupData: Record<string, any[]> = {};
    let totalDocs = 0;

    for (const collectionName of collectionsToBackup) {
        try {
            console.log(`- Backing up '${collectionName}'...`);
            const querySnapshot = await getDocs(collection(db, collectionName));
            const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            backupData[collectionName] = docs;
            console.log(`  ...found ${docs.length} documents.`);
            totalDocs += docs.length;
        } catch (error) {
            console.error(`Error backing up collection ${collectionName}:`, error);
        }
    }

    const backupFilePath = './backup.json';
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));

    console.log('\nBackup complete!');
    console.log(`- Total documents backed up: ${totalDocs}`);
    console.log(`- Backup file created at: ${backupFilePath}`);
    
    // It's necessary to manually exit the process because the Firebase client
    // keeps the script running otherwise.
    process.exit(0);
}

backupData();
