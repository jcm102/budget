import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = { projectId: "demo-project" };
let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
// Use production if local fails, wait, the project uses the emulator in dev mode!
// Let's check package.json for how they start the emulator
