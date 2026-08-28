import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { adminAuth as authAdmin } from '../src/lib/firebase-admin';
import { initializeMonthBudget } from '../src/app/monthly-budget/services/monthly-budget-service';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function test() {
  console.log('Generating custom auth token using Firebase Admin...');
  const customToken = await authAdmin.createCustomToken('test-verification-user');
  
  console.log('Signing in with custom token on client SDK...');
  await signInWithCustomToken(auth, customToken);
  console.log('Successfully authenticated!');

  const testMonth = '2026-09';
  
  // 1. Clean up existing budget items for the test month first to trigger fresh initialization
  console.log(`Cleaning up budget items for ${testMonth}...`);
  const qClean = query(collection(db, 'monthly-budget-items'), where('month', '==', testMonth));
  const snapClean = await getDocs(qClean);
  if (!snapClean.empty) {
    const batch = writeBatch(db);
    snapClean.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`Deleted ${snapClean.size} items.`);
  }

  // 2. Run the initialization logic
  console.log(`Running initializeMonthBudget for ${testMonth}...`);
  await initializeMonthBudget(db, testMonth);

  // 3. Inspect the newly initialized items
  console.log(`Checking budget items for ${testMonth}...`);
  const qInspect = query(collection(db, 'monthly-budget-items'), where('month', '==', testMonth));
  const snapInspect = await getDocs(qInspect);
  console.log(`Found ${snapInspect.size} budget items:`);
  snapInspect.forEach(doc => {
    console.log(`\nDocument ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

test().catch(console.error);
