import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getBudgetItems } from '../src/app/budget/services/budget-service';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

async function run() {
    const accSnap = await getDocs(collection(db, 'transferees'));
    const libroChequing = accSnap.docs.map(d => ({id: d.id, ...d.data()})).find((a: any) => a.name === 'Libro Chequing') as any;

    for (const month of ['2026-09']) {
        console.log(`\n=== MONTH: ${month} ===`);
        const items = await getBudgetItems(db as any, month);
        
        const incomeItems = items.filter(i => i.type === 'Income');
        console.log(`Income items count: ${incomeItems.length}`);
        incomeItems.forEach(i => {
            console.log(`  ID: ${i.id} | Desc: "${i.description}" | Amt: ${i.amount} | Date: ${i.date} | Completed: ${i.completed} | isNextMonthView: ${i.isNextMonthView} | forNextMonth: ${i.forNextMonth} | Frequency: ${i.frequency}`);
        });

        const unrealized = incomeItems
            .filter(item => 
                !item.completed && 
                (!item.destinationAccountId || item.destinationAccountId === libroChequing.id) &&
                !item.isNextMonthView
            )
            .reduce((sum, item) => sum + item.amount, 0);

        console.log(`\nLibro Chequing Actual Balance: ${libroChequing.balance}`);
        console.log(`Unrealized Income for ${month}: ${unrealized}`);
        console.log(`Libro Chequing Book Balance: ${libroChequing.balance + unrealized}`);
    }
}

run().catch(console.error);
