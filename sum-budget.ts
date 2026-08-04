import { initializeFirebase } from './src/firebase/index';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

async function run() {
  const { app } = initializeFirebase();
  const db = getFirestore(app);
  
  const q = query(collection(db, 'monthly-budget-items'), where('month', '==', '2026-08'));
  const snapshot = await getDocs(q);
  
  let housing = 0;
  let sinking = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // Mortgage = MFvekdv68aO9euFYET1l
    // Utilities = QVhx8XnOcxzTs0M3DtOf
    // Sinking Funds = KbWSJVpQRZBOTmu8HxjI
    
    if (data.categoryId === 'MFvekdv68aO9euFYET1l' || data.categoryId === 'QVhx8XnOcxzTs0M3DtOf') {
        housing += data.budgeted || 0;
    }
    if (data.categoryId === 'KbWSJVpQRZBOTmu8HxjI') {
        sinking += data.budgeted || 0;
    }
  });
  
  console.log("Housing/Utilities Monthly Budgeted Total:", housing);
  console.log("Sinking Funds Monthly Budgeted Total:", sinking);
  
  console.log("\nTransfers splits:");
  const snapshot2 = await getDocs(collection(db, 'budget-items'));
  snapshot2.docs.forEach(doc => {
    const data = doc.data();
    if (data.type === 'Transfers') {
      let hSplit = 0;
      let sSplit = 0;
      data.splits?.forEach(s => {
          if (s.categoryId === 'MFvekdv68aO9euFYET1l' || s.categoryId === 'QVhx8XnOcxzTs0M3DtOf') hSplit += s.amount;
          if (s.categoryId === 'KbWSJVpQRZBOTmu8HxjI') sSplit += s.amount;
      });
      if (hSplit > 0 || sSplit > 0) {
          console.log(`Transfer ${doc.id}: Housing=${hSplit}, Sinking=${sSplit}`);
      }
    }
  });
}
run();
