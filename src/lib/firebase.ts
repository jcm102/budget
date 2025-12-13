
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  "projectId": "tasktrack-budget",
  "appId": "1:1046918211235:web:ff0666313439436b7fc116",
  "apiKey": "AIzaSyD2Lqb1HoYVNUjD1LC6HUhRk-Xy1zL3jec",
  "authDomain": "tasktrack-budget.firebaseapp.com",
  "storageBucket": "tasktrack-budget.appspot.com",
  "measurementId": "",
  "messagingSenderId": "1046918211235"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  try {
    // Attempt to initialize via Firebase App Hosting environment variables
    app = initializeApp();
  } catch (e) {
    // Only warn in production because it's normal to use the firebaseConfig to initialize
    // during development
    if (process.env.NODE_ENV === "production") {
      console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
    }
    app = initializeApp(firebaseConfig);
  }
} else {
  app = getApp();
}

const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
