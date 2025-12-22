import * as admin from 'firebase-admin';

// Check if the admin SDK is already initialized to prevent errors on hot-reload
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

export const db = admin.firestore();
