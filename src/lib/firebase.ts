import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "tasktrack-budget",
  "appId": "1:1046918211235:web:ff0666313439436b7fc116",
  "storageBucket": "tasktrack-budget.firebasestorage.app",
  "apiKey": "AIzaSyD2Lqb1HoYVNUjD1LC6HUhRk-Xy1zL3jec",
  "authDomain": "tasktrack-budget.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1046918211235"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

export { db };
