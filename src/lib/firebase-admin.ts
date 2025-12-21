// This file is intended for server-side scripts and uses the Admin SDK.
// It should not be imported into client-side components.
'use server';

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : {
      projectId: 'tasktrack-budget',
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };

const appName = 'firebase-admin-app';
let app: App;

if (!getApps().some((existingApp) => existingApp.name === appName)) {
  app = initializeApp(
    {
      credential: cert(serviceAccount),
    },
    appName
  );
} else {
  app = getApps().find((existingApp) => existingApp.name === appName)!;
}

const db = getFirestore(app);

export { db };
