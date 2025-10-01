
// To run this script, use: npx tsx ./scripts/restore.ts

import * as fs from 'fs';
import { db } from '../src/lib/firebase';
import { collection, doc, writeBatch, getDocs, query, where } from 'firebase/firestore';

const backupFilePath = './backup.json';

async function restoreData() {
    console.log('Starting data restoration from backup.json...');

    if (!fs.existsSync(backupFilePath)) {
        console.error(`Error: Backup file not found at ${backupFilePath}`);
        console.error('Please make sure you have a valid backup.json file in the root directory.');
        process.exit(1);
    }

    const backupData: Record<string, any[]> = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8'));
    let totalDocsRestored = 0;

    const batch = writeBatch(db);

    for (const collectionName in backupData) {
        if (Object.prototype.hasOwnProperty.call(backupData, collectionName)) {
            const documents = backupData[collectionName];
            console.log(`- Restoring collection '${collectionName}' with ${documents.length} documents...`);
            
            if (documents.length === 0) {
                console.log(`  ...skipping empty collection.`);
                continue;
            }

            // For safety, let's only restore 'monthly-budget-items' for now as that's what was lost.
            // You can comment out this check to restore everything.
            if (collectionName !== 'monthly-budget-items') {
                console.log(`  ...skipping collection '${collectionName}' for safety. Edit the script to restore all collections.`);
                continue;
            }

            for (const docData of documents) {
                const docId = docData.id;
                if (!docId) {
                    console.warn(`  ...document in '${collectionName}' is missing an 'id'. Skipping.`);
                    continue;
                }
                const docRef = doc(db, collectionName, docId);
                const { id, ...data } = docData; // remove id from data payload
                batch.set(docRef, data);
            }
            totalDocsRestored += documents.length;
        }
    }

    try {
        await batch.commit();
        console.log('\nRestoration complete!');
        console.log(`- Total documents restored: ${totalDocsRestored}`);
        console.log('- Please refresh your application to see the restored data.');
    } catch (error) {
        console.error('\nError committing batch:', error);
        console.error('Data restoration failed.');
        process.exit(1);
    }
    
    // It's necessary to manually exit the process because the Firebase client
    // keeps the script running otherwise.
    process.exit(0);
}

restoreData();
