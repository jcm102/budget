import * as admin from 'firebase-admin';

// Helper to handle the private key formatting
function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  let formatted = key.trim();
  // Strip outer quotes if enclosed in single or double quotes
  if ((formatted.startsWith('"') && formatted.endsWith('"')) || (formatted.startsWith("'") && formatted.endsWith("'"))) {
    formatted = formatted.slice(1, -1);
  }
  // Handles both escaped newlines (\n) and actual newlines
  return formatted.replace(/\\n/g, '\n');
}

function getCredentials() {
  const projectId = 
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
    process.env.FIREBASE_PROJECT_ID || 
    process.env.GCP_PROJECT ||
    process.env.GCLOUD_PROJECT;

  const clientEmail = 
    process.env.FB_CLIENT_EMAIL || 
    process.env.FIREBASE_CLIENT_EMAIL;

  const rawKey = 
    process.env.FB_PRIVATE_KEY || 
    process.env.FIREBASE_PRIVATE_KEY;

  const privateKey = formatPrivateKey(rawKey);

  return { projectId, clientEmail, privateKey };
}

function ensureInitialized(): boolean {
  if (admin.apps.length > 0) return true;

  const { projectId, clientEmail, privateKey } = getCredentials();

  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Firebase Admin failed to initialize: Missing Environment Variables.");
    console.error(
      `Checked: clientEmail (${!!clientEmail}), privateKey (${!!privateKey}), projectId (${!!projectId})`
    );
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log("✅ Firebase Admin initialized successfully for project:", projectId);
    return true;
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error);
    return false;
  }
}

// Initial attempt on load
ensureInitialized();

function getDbInstance(): admin.firestore.Firestore {
  if (!ensureInitialized()) {
    const { projectId, clientEmail, privateKey } = getCredentials();
    const missing = [
      !projectId && 'PROJECT_ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID / FIREBASE_PROJECT_ID)',
      !clientEmail && 'CLIENT_EMAIL (FB_CLIENT_EMAIL / FIREBASE_CLIENT_EMAIL)',
      !privateKey && 'PRIVATE_KEY (FB_PRIVATE_KEY / FIREBASE_PRIVATE_KEY)',
    ].filter(Boolean).join(', ');
    throw new Error(
      `Firebase Admin DB is not initialized. Missing environment variables: [${missing}]. Please check your environment or .env file.`
    );
  }
  return admin.firestore();
}

function getAuthInstance(): admin.auth.Auth {
  if (!ensureInitialized()) {
    throw new Error('Firebase Admin Auth is not initialized. Missing credentials.');
  }
  return admin.auth();
}

// Safe proxy so callers can do db.collection(...), db.batch(), etc. seamlessly
const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop) {
    const instance = getDbInstance();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_target, prop) {
    const instance = getAuthInstance();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

export { adminDb, adminDb as db, adminAuth, ensureInitialized };