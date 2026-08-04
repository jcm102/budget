import { initializeFirebase } from './src/firebase/index';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';

async function run() {
  const { app } = initializeFirebase();
  const db = getFirestore(app);
  
  // Delete one of the duplicate housing transfers
  await deleteDoc(doc(db, 'budget-items', 'PEAZaYfpC4MSVR26PVjY'));
  console.log('Deleted duplicate housing transfer: PEAZaYfpC4MSVR26PVjY');
  
  // Delete old Sinking Funds transfers
  await deleteDoc(doc(db, 'budget-items', 'ptAHzJKbxbsg91Q7ABc7'));
  console.log('Deleted old sinking funds transfer: ptAHzJKbxbsg91Q7ABc7');
  
  await deleteDoc(doc(db, 'budget-items', 'sinking-funds-transfer-2026-10'));
  console.log('Deleted old sinking funds transfer: sinking-funds-transfer-2026-10');
}
run();
