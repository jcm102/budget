import { initializeFirebase } from './src/firebase/index';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

async function run() {
  const { app } = initializeFirebase();
  const db = getFirestore(app);
  
  const categoriesSnap = await getDocs(collection(db, 'budget-categories'));
  const categories = categoriesSnap.docs.reduce((acc, doc) => {
      acc[doc.id] = { name: doc.data().name, parentId: doc.data().parentId };
      return acc;
  }, {} as any);
  
  const q = query(collection(db, 'monthly-budget-items'), where('month', '==', '2026-08'));
  const snapshot = await getDocs(q);
  
  let total = 0;
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const cat = categories[data.categoryId];
    const parentName = cat?.parentId ? categories[cat.parentId]?.name : 'None';
    if (parentName === 'Housing & Utilities' || cat?.name === 'Housing & Utilities') {
       console.log("ID:", doc.id, "Cat:", cat?.name, "Budgeted:", data.budgeted, "Parent:", parentName);
       total += data.budgeted;
    }
  });
  console.log("Total for Housing & Utilities:", total);
}
run();
