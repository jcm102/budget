// This file is intended for server-side scripts and uses the Admin SDK.
// It should not be imported into client-side components.

import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// IMPORTANT: The service account key is injected via environment variables
// in a secure production environment. For local development, you might
// use a local file, but it should not be committed to version control.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : {
      "projectId": "tasktrack-budget",
      // This is a placeholder and will not work without a real private key.
      // In a real environment, the full service account JSON would be used.
      "privateKey": "-----BEGIN PRIVATE KEY-----\n\n-----END PRIVATE KEY-----\n",
      "clientEmail": "firebase-adminsdk-xxxxx@tasktrack-budget.iam.gserviceaccount.com"
    };

const appName = 'firebase-admin-app';

let app;
if (!getApps().some(existingApp => existingApp.name === appName)) {
  app = initializeApp({
    credential: cert(serviceAccount)
  }, appName);
} else {
  app = getApp(appName);
}

const dbAdmin = getFirestore(app);

export { dbAdmin as db };
