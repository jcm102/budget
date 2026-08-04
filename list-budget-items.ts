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
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.categoryId === 'MFvekdv68aO9euFYET1l' || data.categoryId === 'QVhx8XnOcxzTs0M3DtOf' || data.categoryId === 'KbWSJVpQRZBOTmu8HxjI') {
        console.log("ID:", doc.id, "Cat:", categories[data.categoryId], "Budgeted:", data.budgeted, "Category:", data.categoryId);
    }
  });
}
run();
