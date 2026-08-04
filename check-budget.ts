import { initializeFirebase } from './src/firebase/index';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

async function run() {
  const { app } = initializeFirebase();
  const db = getFirestore(app);
  
  // Also check budget categories
  const categoriesSnap = await getDocs(collection(db, 'budget-categories'));
  const categories = categoriesSnap.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data().name;
      return acc;
  }, {} as any);

  const q = query(collection(db, 'monthly-budget-items'), where('month', '==', '2026-08'));
  const snapshot = await getDocs(q);
  
  let total = 0;
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, categories[data.categoryId], data.name, data.budgeted, data.categoryId);
  });
  
  console.log("--- budget-items ---")
  const snapshot2 = await getDocs(collection(db, 'budget-items'));
  snapshot2.docs.forEach(doc => {
    const data = doc.data();
    if (data.type === 'Transfers') {
      console.log(doc.id, data.amount, data.splits);
    } else {
      console.log(doc.id, categories[data.categoryId], data.name, data.budgeted, data.categoryId);
    }
  });
}
run();
