// This file is intended for server-side scripts and uses the Admin SDK.
// It should not be imported into client-side components.
'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const appName = 'firebase-admin-app';
let app: App;

// The environment in Firebase Studio handles admin initialization automatically.
// We just need to ensure it's initialized only once.
if (!getApps().some((existingApp) => existingApp.name === appName)) {
  app = initializeApp(undefined, appName);
} else {
  app = getApps().find((existingApp) => existingApp.name === appName)!;
}

const db = getFirestore(app);

export { db };
