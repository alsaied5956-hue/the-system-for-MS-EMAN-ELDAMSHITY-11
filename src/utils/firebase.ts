import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  setLogLevel,
  Firestore
} from "firebase/firestore";
import config from "../../firebase-applet-config.json";

// Suppress benign connection retry / quota / offline notice logs from spamming console
try {
  setLogLevel("silent");
} catch {
  // Ignore
}

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(config) : getApp();

// Initialize Firestore Database instance with modern multi-tab persistent cache
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
} catch {
  // Fallback if already initialized
  dbInstance = getFirestore(app, config.firestoreDatabaseId || undefined);
}

export const db = dbInstance;
export { app };

