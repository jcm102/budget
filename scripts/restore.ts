
// To run this script, use: npx tsx ./scripts/restore.ts

import * as fs from 'fs';
import { db } from '../src/lib/firebase';
import { collection, doc, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import readline from 'readline';

const backupsCollection = 'backups';

async function listBackups() {
  const backupCollectionRef = collection(db, backupsCollection);
  const snapshot = await getDocs(backupCollectionRef);

  if (snapshot.empty) {
    console.log('No backups found.');
    return [];
  }

  const backups = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Sort by createdAt date descending
  backups.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

  console.log('Available backups:');
  backups.slice(0, 10).forEach((backup, index) => {
    console.log(`${index + 1}. ${backup.id} - ${new Date(backup.createdAt.toDate()).toLocaleString()} (${backup.reason})`);
  });

  return backups;
}

async function restoreData() {
  const backups = await listBackups();
  if (backups.length === 0) {
    process.exit(0);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter the number of the backup to restore (or press Enter to cancel): ', async (answer) => {
    rl.close();

    const choice = parseInt(answer, 10);
    if (isNaN(choice) || choice < 1 || choice > backups.length) {
      console.log('Invalid choice. Restoration cancelled.');
      process.exit(0);
    }

    const selectedBackup = backups[choice - 1];
    console.log(`\nRestoring from backup: ${selectedBackup.id}`);

    const backupData = selectedBackup.data;
    let totalDocsRestored = 0;
    const batch = writeBatch(db);

    // Clear existing collections before restoring
    console.log('Clearing existing data...');
    for (const collectionName in backupData) {
        if (Object.prototype.hasOwnProperty.call(backupData, collectionName)) {
            const collectionRef = collection(db, collectionName);
            const snapshot = await getDocs(collectionRef);
            console.log(`- Deleting ${snapshot.size} documents from '${collectionName}'...`);
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
    }
    try {
        await batch.commit();
        console.log('Existing data cleared successfully.');
    } catch(e) {
        console.error("Error clearing data", e);
        process.exit(1);
    }
    

    // Restore from backup
    const restoreBatch = writeBatch(db);
    console.log('Starting data restoration...');
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

    try {
        await restoreBatch.commit();
        console.log('\nRestoration complete!');
        console.log(`- Total documents restored: ${totalDocsRestored}`);
        console.log('- Please refresh your application to see the restored data.');
    } catch (error) {
        console.error('\nError committing batch:', error);
        console.error('Data restoration failed.');
        process.exit(1);
    }
    
    process.exit(0);
  });
}

restoreData();
