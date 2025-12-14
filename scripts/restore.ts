// To run this script, use: npx tsx ./scripts/restore.ts

import * as fs from 'fs';
import { db } from '../src/lib/firebase-admin'; // Use the admin instance
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import readline from 'readline';

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


async function restoreData() {
    const backupFilePath = './backup.json';
    if (!fs.existsSync(backupFilePath)) {
        console.error(`Backup file not found at: ${backupFilePath}`);
        process.exit(1);
    }
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Are you sure you want to restore from backup.json? This will overwrite all existing data. (y/n) ', async (answer) => {
        rl.close();

        if (answer.toLowerCase() !== 'y') {
            console.log('Restoration cancelled.');
            process.exit(0);
        }
        
        console.log('\nStarting data restoration from backup.json...');
        
        try {
            const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8'));
            let totalDocsRestored = 0;

            // Clear existing collections before restoring
            console.log('Clearing existing data...');
            const deleteBatch = writeBatch(db);
            for (const collectionName of collectionsToBackup) {
                const collectionRef = collection(db, collectionName);
                const snapshot = await getDocs(collectionRef);
                console.log(`- Deleting ${snapshot.size} documents from '${collectionName}'...`);
                snapshot.forEach(doc => {
                    deleteBatch.delete(doc.ref);
                });
            }
            await deleteBatch.commit();
            console.log('Existing data cleared successfully.');

            // Restore from backup
            const restoreBatch = writeBatch(db);
            console.log('Restoring data...');
            for (const collectionName in backupData) {
                if (Object.prototype.hasOwnProperty.call(backupData, collectionName)) {
                    const documents = backupData[collectionName];
                    console.log(`- Restoring collection '${collectionName}' with ${documents.length} documents...`);
                    
                    for (const docData of documents) {
                        const docId = docData.id;
                        if (!docId) {
                            console.warn(`  ...document in '${collectionName}' is missing an 'id'. Skipping.`);
                            continue;
                        }
                        const docRef = doc(db, collectionName, docId);
                        const { id, ...data } = docData;
                        restoreBatch.set(docRef, data);
                    }
                    totalDocsRestored += documents.length;
                }
            }
            
            await restoreBatch.commit();
            console.log('\nRestoration complete!');
            console.log(`- Total documents restored: ${totalDocsRestored}`);
            console.log('- Please refresh your application to see the restored data.');
        } catch (error) {
            console.error('\nError during restoration process:', error);
            process.exit(1);
        }

        process.exit(0);
    });
}

restoreData();
