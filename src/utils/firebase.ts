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

// Initialize Auth and ensure anonymous session is established
export const auth: Auth = getAuth(app);
let isAuthReady = false;
let authPromise: Promise<boolean> | null = null;

export async function ensureFirebaseAuth(): Promise<boolean> {
  if (isAuthReady && auth.currentUser) return true;
  if (authPromise) return authPromise;

  authPromise = new Promise<boolean>((resolve) => {
    // Check if already signed in
    if (auth.currentUser) {
      isAuthReady = true;
      resolve(true);
      return;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        isAuthReady = true;
        unsub();
        resolve(true);
      }
    });

    signInAnonymously(auth)
      .then(() => {
        isAuthReady = true;
        resolve(true);
      })
      .catch((err) => {
        console.warn("Anonymous sign in notice:", err);
        // Resolve true anyway so firestore can still proceed
        resolve(false);
      });

    // Safety timeout after 3s
    setTimeout(() => {
      resolve(!!auth.currentUser);
    }, 3000);
  });

  return authPromise;
}

// Start auth immediately in background
ensureFirebaseAuth().catch(() => {});

// Initialize Firestore Database instance with resilient fallback
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    config.firestoreDatabaseId || undefined
  );
} catch (e1) {
  try {
    dbInstance = initializeFirestore(
      app,
      {
        localCache: memoryLocalCache(),
      },
      config.firestoreDatabaseId || undefined
    );
  } catch (e2) {
    dbInstance = getFirestore(app, config.firestoreDatabaseId || undefined);
  }
}

export const db = dbInstance;

