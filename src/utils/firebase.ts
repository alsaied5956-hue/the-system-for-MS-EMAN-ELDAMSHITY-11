import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel,
  Firestore
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged, Auth } from "firebase/auth";
import config from "../../firebase-applet-config.json";

// Suppress benign connection retry / quota / offline notice logs from spamming console
try {
  setLogLevel("silent");
} catch {
  // Ignore
}

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(config) : getApp();

// Initialize Auth and ensure anonymous session is established if supported
export const auth: Auth = getAuth(app);
let isAuthAttempted = false;

export async function ensureFirebaseAuth(): Promise<boolean> {
  if (auth.currentUser) {
    return true;
  }
  if (isAuthAttempted) {
    return !!auth.currentUser;
  }
  isAuthAttempted = true;

  try {
    await signInAnonymously(auth);
    return true;
  } catch (err) {
    // Anonymous auth may be disabled or restricted on project;
    // Database rules allow direct access to system_state so app continues seamlessly.
    return false;
  }
}

// Attempt background auth once without blocking startup
ensureFirebaseAuth().catch(() => {});

// Initialize Firestore Database instance with resilient in-memory cache
// Using memoryLocalCache completely prevents IndexedDB multi-tab lock corruptions,
// stale target watch streams (ID: ca9 / b815 / c050), and iframe persistence crashes.
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      localCache: memoryLocalCache(),
    },
    config.firestoreDatabaseId || undefined
  );
} catch {
  dbInstance = getFirestore(app, config.firestoreDatabaseId || undefined);
}

export const db = dbInstance;

