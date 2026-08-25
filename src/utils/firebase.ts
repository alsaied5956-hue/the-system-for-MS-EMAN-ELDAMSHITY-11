import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  enableIndexedDbPersistence 
} from "firebase/firestore";
import config from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(config) : getApp();

// Initialize Firestore Database instance
export const db = getFirestore(app, config.firestoreDatabaseId || undefined);

// Enable offline caching persistence if in browser
if (typeof window !== "undefined") {
  try {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === "failed-precondition") {
        console.warn("Firestore persistence failed: Multiple tabs open.");
      } else if (err.code === "unimplemented") {
        console.warn("Firestore persistence not supported in this browser.");
      }
    });
  } catch (e) {
    // Ignore persistence errors
  }
}

export { app };
