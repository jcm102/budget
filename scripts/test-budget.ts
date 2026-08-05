import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const q = query(collection(db, 'budget-items'), where('type', '==', 'Income'));
    const snap = await getDocs(q);
    snap.forEach(d => {
        const data = d.data();
        if (data.originalId || data.description.toLowerCase().includes('paycheque')) {
            console.log(d.id, JSON.stringify(data));
        }
    });
}
run().catch(console.error);
