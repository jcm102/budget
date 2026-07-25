import * as admin from 'firebase-admin';

// Helper to handle the private key formatting
function formatPrivateKey(key: string | undefined) {
  if (!key) return undefined;
  // This handles both escaped newlines (\n) and actual newlines
  return key.replace(/\\n/g, '\n');
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
// Using the new 'FB_' prefix to bypass Firebase's reserved naming rules
const clientEmail = process.env.FB_CLIENT_EMAIL;
const privateKey = formatPrivateKey(process.env.FB_PRIVATE_KEY);

if (!admin.apps.length) {
  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Firebase Admin failed to initialize: Missing Environment Variables.");
    console.log("Check for: FB_CLIENT_EMAIL, FB_PRIVATE_KEY, and NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("✅ Firebase Admin initialized successfully");
    } catch (error) {
      console.error("❌ Firebase Admin initialization error:", error);
    }
  }
}

let adminDb: admin.firestore.Firestore;
let adminAuth: admin.auth.Auth;

if (admin.apps.length) {
  adminDb = admin.firestore();
  adminAuth = admin.auth();
} else {
  // If not initialized, fallback to dummy or safe proxies to prevent module import crashes
  adminDb = null as any;
  adminAuth = null as any;
}

export { adminDb, adminDb as db, adminAuth };