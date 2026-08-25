import { Student, UserAccount, GradeName, PaymentRecord, PermissionKey } from "../types";
import { DEFAULT_GRADE_PRICES, getTodayKey } from "./helpers";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

const STORAGE_KEY = "center_data_v2";

export interface SystemData {
  students: Student[];
  attendanceHistory: Record<string, Record<string, string>>; // { "2026-08-25": { "1001": "حضور" } }
  attendanceToday: Record<string, string>;
  scanLogTimes: Record<string, string>; // ISO date string
  payments: Record<string, Record<string, PaymentRecord>>; // { "2026-08": { "1001": { amount: 100, ... } } }
  scanLogOrder: string[];
  usersList: UserAccount[];
  groupPrices: Record<GradeName, number>;
  activeSessionSlotId: string;
}

export const ALL_PERMISSIONS: PermissionKey[] = [
  "add_student",
  "edit_student",
  "delete_student",
  "change_status",
  "pay_expenses",
  "view_revenues",
  "add_grades",
  "send_messages",
  "manage_prices",
  "early_warning",
  "certificates",
  "excel_integration",
];

export const DEFAULT_USERS: UserAccount[] = [
  {
    username: "admin",
    pass: "admin123",
    role: "admin",
    permissions: [...ALL_PERMISSIONS],
  },
];

export const INITIAL_SYSTEM_DATA: SystemData = {
  students: [],
  attendanceHistory: {},
  attendanceToday: {},
  scanLogTimes: {},
  payments: {},
  scanLogOrder: [],
  usersList: DEFAULT_USERS,
  groupPrices: DEFAULT_GRADE_PRICES,
  activeSessionSlotId: "auto",
};

/**
 * Load local data from LocalStorage immediately for zero-delay startup
 */
export function loadLocalData(): SystemData {
  if (typeof window === "undefined") return INITIAL_SYSTEM_DATA;

  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("center_data");
    if (raw) {
      const parsed = JSON.parse(raw);
      const todayKey = getTodayKey();
      return {
        students: Array.isArray(parsed.students) ? parsed.students : [],
        attendanceHistory: parsed.attendanceHistory || {},
        attendanceToday: parsed.attendanceHistory?.[todayKey] || parsed.attendanceToday || {},
        scanLogTimes: parsed.scanLogTimes || {},
        payments: parsed.payments || {},
        scanLogOrder: Array.isArray(parsed.scanLogOrder) ? parsed.scanLogOrder : [],
        usersList: Array.isArray(parsed.usersList) && parsed.usersList.length > 0 ? parsed.usersList : DEFAULT_USERS,
        groupPrices: { ...DEFAULT_GRADE_PRICES, ...(parsed.groupPrices || {}) },
        activeSessionSlotId: parsed.activeSessionSlotId || "auto",
      };
    }
  } catch (e) {
    console.error("Error loading local data:", e);
  }

  return INITIAL_SYSTEM_DATA;
}

/**
 * Save data to browser LocalStorage as high-speed instant cache
 */
export function saveToLocalStorage(data: SystemData): void {
  if (typeof window === "undefined") return;
  try {
    const todayKey = getTodayKey();
    if (!data.attendanceHistory) data.attendanceHistory = {};
    data.attendanceHistory[todayKey] = data.attendanceToday || {};

    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);
    localStorage.setItem("center_data", serialized);
  } catch (e) {
    console.error("Local storage save error:", e);
  }
}

/**
 * Helper to strip undefined values so Firestore doesn't reject document updates
 */
function cleanForFirestore(obj: unknown): unknown {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      result[key] = cleanForFirestore(value);
    }
  }
  return result;
}

/**
 * Sync entire system data state to Firestore cloud database
 */
export async function syncDataToCloud(data: SystemData): Promise<void> {
  // Always save locally first for instant offline responsiveness
  saveToLocalStorage(data);

  if (typeof window !== "undefined" && navigator.onLine) {
    try {
      const todayKey = getTodayKey();
      if (!data.attendanceHistory) data.attendanceHistory = {};
      data.attendanceHistory[todayKey] = data.attendanceToday || {};

      const systemDocRef = doc(db, "system_state", "main_center_data");
      const cleaned = cleanForFirestore({
        ...data,
        updatedAt: new Date().toISOString(),
      });

      await setDoc(systemDocRef, cleaned as Record<string, unknown>, { merge: true });
    } catch (e) {
      console.warn("Cloud sync to Firestore failed, kept locally:", e);
    }
  }
}

export function loadInitialData(): SystemData {
  return loadLocalData();
}

/**
 * Real-time continuous listener to Firestore cloud database
 * Updates local UI and LocalStorage instantaneously whenever any device writes data
 */
export function subscribeToCloudData(
  onUpdate: (data: SystemData) => void,
  onError?: (err: unknown) => void
): () => void {
  try {
    const systemDocRef = doc(db, "system_state", "main_center_data");

    const unsubscribe = onSnapshot(
      systemDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.data();
          if (val) {
            const merged: SystemData = {
              students: Array.isArray(val.students) ? val.students : [],
              attendanceHistory: val.attendanceHistory || {},
              attendanceToday: val.attendanceToday || {},
              scanLogTimes: val.scanLogTimes || {},
              payments: val.payments || {},
              scanLogOrder: Array.isArray(val.scanLogOrder) ? val.scanLogOrder : [],
              usersList: Array.isArray(val.usersList) && val.usersList.length > 0 ? val.usersList : DEFAULT_USERS,
              groupPrices: { ...DEFAULT_GRADE_PRICES, ...(val.groupPrices || {}) },
              activeSessionSlotId: val.activeSessionSlotId || "auto",
            };

            const todayKey = getTodayKey();
            if (merged.attendanceHistory[todayKey]) {
              merged.attendanceToday = merged.attendanceHistory[todayKey];
            }

            saveToLocalStorage(merged);
            onUpdate(merged);
          }
        } else {
          // If remote cloud document doesn't exist yet, seed it with current local data
          const currentLocal = loadLocalData();
          syncDataToCloud(currentLocal);
        }
      },
      (error) => {
        console.warn("Firestore snapshot listener error:", error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn("Firebase Firestore subscription failed:", err);
    if (onError) onError(err);
    return () => {};
  }
}

export function saveStudentsData(students: Student[]): void {
  const current = loadLocalData();
  const updated: SystemData = { ...current, students };
  syncDataToCloud(updated);
}

export function saveAttendanceTodayData(attendanceToday: Record<string, string>): void {
  const current = loadLocalData();
  const todayKey = getTodayKey();
  const updated: SystemData = {
    ...current,
    attendanceToday,
    attendanceHistory: {
      ...current.attendanceHistory,
      [todayKey]: attendanceToday,
    },
  };
  syncDataToCloud(updated);
}

export function savePaymentsData(payments: Record<string, Record<string, PaymentRecord>>): void {
  const current = loadLocalData();
  const updated: SystemData = { ...current, payments };
  syncDataToCloud(updated);
}

export function saveGroupPricesData(groupPrices: Record<GradeName, number>): void {
  const current = loadLocalData();
  const updated: SystemData = { ...current, groupPrices };
  syncDataToCloud(updated);
}

export function saveUsersData(usersList: UserAccount[]): void {
  const current = loadLocalData();
  const updated: SystemData = { ...current, usersList };
  syncDataToCloud(updated);
}
