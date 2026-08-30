import { Student, UserAccount, GradeName, PaymentRecord, PermissionKey, PendingWhatsAppMessage, WhatsAppMessageType } from "../types";
import { DEFAULT_GRADE_PRICES, getTodayKey, formatTimeArabic } from "./helpers";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

const STORAGE_KEY = "center_data_v2";
const PENDING_SYNC_KEY = "center_pending_sync_v2";
const LAST_SYNC_TIME_KEY = "center_last_sync_time";

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
  pendingWhatsAppMessages: PendingWhatsAppMessage[];
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  hasPendingSync: boolean;
  lastSyncTime: string | null;
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
  pendingWhatsAppMessages: [],
};

// Internal memory cache & sync flags
let memoryCachedData: SystemData | null = null;
let lastSyncedDataHash: string = "";
let debounceSyncTimer: ReturnType<typeof setTimeout> | null = null;
let isCurrentlySyncing: boolean = false;
let syncTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let prevStatusSnapshot: string = "";

// Subscribed listeners for sync status changes
const syncStatusListeners: Array<(status: SyncStatus) => void> = [];

function notifySyncStatusChange(): void {
  const status = getSyncStatus();
  const serialized = `${status.isOnline}_${status.isSyncing}_${status.hasPendingSync}_${status.lastSyncTime}`;
  if (serialized === prevStatusSnapshot) return;
  prevStatusSnapshot = serialized;

  syncStatusListeners.forEach((cb) => {
    try {
      cb(status);
    } catch (e) {
      console.warn("Error in sync status listener callback:", e);
    }
  });
}

/**
 * Get current connectivity and synchronization status
 */
export function getSyncStatus(): SyncStatus {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  let hasPendingSync = false;
  let lastSyncTime: string | null = null;

  if (typeof window !== "undefined") {
    hasPendingSync = localStorage.getItem(PENDING_SYNC_KEY) === "true";
    lastSyncTime = localStorage.getItem(LAST_SYNC_TIME_KEY);
  }

  return {
    isOnline,
    isSyncing: isCurrentlySyncing,
    hasPendingSync,
    lastSyncTime,
  };
}

/**
 * Subscribe to connectivity and sync status changes
 */
export function subscribeToSyncStatus(callback: (status: SyncStatus) => void): () => void {
  syncStatusListeners.push(callback);
  callback(getSyncStatus());
  return () => {
    const idx = syncStatusListeners.indexOf(callback);
    if (idx !== -1) {
      syncStatusListeners.splice(idx, 1);
    }
  };
}

/**
 * Load local data from LocalStorage immediately for zero-delay startup
 */
export function loadLocalData(): SystemData {
  if (memoryCachedData) return memoryCachedData;
  if (typeof window === "undefined") return INITIAL_SYSTEM_DATA;

  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("center_data");
    if (raw) {
      const parsed = JSON.parse(raw);
      const todayKey = getTodayKey();
      const loaded: SystemData = {
        students: Array.isArray(parsed.students) ? parsed.students : [],
        attendanceHistory: parsed.attendanceHistory || {},
        attendanceToday: parsed.attendanceHistory?.[todayKey] || parsed.attendanceToday || {},
        scanLogTimes: parsed.scanLogTimes || {},
        payments: parsed.payments || {},
        scanLogOrder: Array.isArray(parsed.scanLogOrder) ? parsed.scanLogOrder : [],
        usersList: Array.isArray(parsed.usersList) && parsed.usersList.length > 0 ? parsed.usersList : DEFAULT_USERS,
        groupPrices: { ...DEFAULT_GRADE_PRICES, ...(parsed.groupPrices || {}) },
        activeSessionSlotId: parsed.activeSessionSlotId || "auto",
        pendingWhatsAppMessages: Array.isArray(parsed.pendingWhatsAppMessages) ? parsed.pendingWhatsAppMessages : [],
      };
      memoryCachedData = loaded;
      return loaded;
    }
  } catch (e) {
    console.error("Error loading local data:", e);
  }

  memoryCachedData = INITIAL_SYSTEM_DATA;
  return INITIAL_SYSTEM_DATA;
}

let localSaveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Save data to browser LocalStorage as high-speed instant cache (0ms latency, throttled write)
 */
export function saveToLocalStorage(data: SystemData): void {
  memoryCachedData = data;
  if (typeof window === "undefined") return;

  const todayKey = getTodayKey();
  if (!data.attendanceHistory) data.attendanceHistory = {};
  data.attendanceHistory[todayKey] = data.attendanceToday || {};

  // Debounce actual localStorage disk write by 60ms to prevent main thread blocking during fast typing/scanning
  if (localSaveTimeout) {
    clearTimeout(localSaveTimeout);
  }

  localSaveTimeout = setTimeout(() => {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (e) {
      console.error("Local storage save error:", e);
    }
  }, 60);
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
 * Perform a direct, guaranteed push of local data to Firestore Cloud Database
 */
export async function flushPendingSyncToCloud(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!navigator.onLine) {
    isCurrentlySyncing = false;
    notifySyncStatusChange();
    return false;
  }

  if (isCurrentlySyncing) {
    return true;
  }

  const data = loadLocalData();
  const todayKey = getTodayKey();
  if (!data.attendanceHistory) data.attendanceHistory = {};
  data.attendanceHistory[todayKey] = data.attendanceToday || {};

  isCurrentlySyncing = true;
  notifySyncStatusChange();

  // Safety fallback: if network hangs, release the 'isSyncing' flag after 4 seconds
  if (syncTimeoutTimer) clearTimeout(syncTimeoutTimer);
  syncTimeoutTimer = setTimeout(() => {
    if (isCurrentlySyncing) {
      isCurrentlySyncing = false;
      notifySyncStatusChange();
    }
  }, 4000);

  try {
    const dataHash = JSON.stringify(data);
    lastSyncedDataHash = dataHash;

    const systemDocRef = doc(db, "system_state", "main_center_data");
    const cleaned = cleanForFirestore({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    await setDoc(systemDocRef, cleaned as Record<string, unknown>, { merge: true });

    // Mark as completely synced in localStorage
    localStorage.setItem(PENDING_SYNC_KEY, "false");
    const nowIso = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    localStorage.setItem(LAST_SYNC_TIME_KEY, nowIso);

    isCurrentlySyncing = false;
    if (syncTimeoutTimer) clearTimeout(syncTimeoutTimer);
    notifySyncStatusChange();

    // Dispatch global custom event so UI can display a success toast if needed
    window.dispatchEvent(
      new CustomEvent("cloud-sync-completed", {
        detail: { timestamp: new Date().toISOString() },
      })
    );

    return true;
  } catch (e) {
    console.warn("Cloud sync to Firestore notice (offline queue active):", e);
    localStorage.setItem(PENDING_SYNC_KEY, "true");
    isCurrentlySyncing = false;
    if (syncTimeoutTimer) clearTimeout(syncTimeoutTimer);
    notifySyncStatusChange();
    return false;
  }
}

/**
 * Sync entire system data state to Firestore cloud database with automatic offline queueing
 */
export function syncDataToCloud(data: SystemData): void {
  // 1. Instant local persistence (0ms latency, works 100% offline)
  saveToLocalStorage(data);

  if (typeof window !== "undefined") {
    // Mark as having pending sync until cloud push completes
    localStorage.setItem(PENDING_SYNC_KEY, "true");
    notifySyncStatusChange();
  }

  // 2. Debounce cloud network push by 600ms to eliminate UI stutter and merge rapid consecutive edits
  if (debounceSyncTimer) {
    clearTimeout(debounceSyncTimer);
  }

  debounceSyncTimer = setTimeout(async () => {
    if (typeof window !== "undefined" && navigator.onLine && !isCurrentlySyncing) {
      await flushPendingSyncToCloud();
    }
  }, 600);
}

export function loadInitialData(): SystemData {
  return loadLocalData();
}

/**
 * Real-time continuous listener to Firestore cloud database
 * Updates local UI only when genuine changes from other devices arrive
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
        // Skip local write echoes to prevent UI lag and infinite write-loops
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }

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
              pendingWhatsAppMessages: Array.isArray(val.pendingWhatsAppMessages) ? val.pendingWhatsAppMessages : [],
            };

            const todayKey = getTodayKey();
            if (merged.attendanceHistory[todayKey]) {
              merged.attendanceToday = merged.attendanceHistory[todayKey];
            }

            const incomingHash = JSON.stringify(merged);
            // Skip updating state if there are no actual differences
            if (incomingHash === lastSyncedDataHash) {
              return;
            }

            lastSyncedDataHash = incomingHash;
            saveToLocalStorage(merged);
            localStorage.setItem(PENDING_SYNC_KEY, "false");
            notifySyncStatusChange();
            onUpdate(merged);
          }
        }
      },
      (error) => {
        console.warn("Firestore snapshot listener notice (working locally):", error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn("Firebase Firestore subscription notice (working locally):", err);
    if (onError) onError(err);
    return () => {};
  }
}

// -------------------------------------------------------------
// Auto-Sync Event Handlers: Online, Visibility, and Heartbeat
// -------------------------------------------------------------
if (typeof window !== "undefined") {
  // 1. Flush immediately when network connection is restored
  window.addEventListener("online", () => {
    notifySyncStatusChange();
    flushPendingSyncToCloud();
  });

  // 2. Notify when offline
  window.addEventListener("offline", () => {
    notifySyncStatusChange();
  });

  // 3. Trigger sync when returning to tab/window
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      const hasPending = localStorage.getItem(PENDING_SYNC_KEY) === "true";
      if (hasPending && !isCurrentlySyncing) {
        flushPendingSyncToCloud();
      }
    }
  });

  // 4. Periodic background sync checker every 20 seconds
  setInterval(() => {
    if (navigator.onLine) {
      const hasPending = localStorage.getItem(PENDING_SYNC_KEY) === "true";
      if (hasPending && !isCurrentlySyncing) {
        flushPendingSyncToCloud();
      }
    }
  }, 20000);
}

// Helper methods for saving specific slices of system data
export function saveStudentsData(students: Student[]): void {
  const current = loadLocalData();
  const updated: SystemData = { ...current, students };
  syncDataToCloud(updated);
}

export function saveAttendanceTodayData(
  attendanceToday: Record<string, string>,
  scanLogOrder?: string[],
  scanLogTimes?: Record<string, string>
): void {
  const current = loadLocalData();
  const todayKey = getTodayKey();
  const updated: SystemData = {
    ...current,
    attendanceToday,
    attendanceHistory: {
      ...current.attendanceHistory,
      [todayKey]: attendanceToday,
    },
    scanLogOrder: scanLogOrder !== undefined ? scanLogOrder : (current.scanLogOrder || []),
    scanLogTimes: scanLogTimes !== undefined ? scanLogTimes : (current.scanLogTimes || {}),
  };
  syncDataToCloud(updated);
}

/**
 * Efficient atomic batch save for attendance + updated student counts in a SINGLE sync operation
 */
export function saveAttendanceAndStudentsBatch(
  attendanceToday: Record<string, string>,
  scanLogOrder: string[],
  scanLogTimes: Record<string, string>,
  students: Student[]
): void {
  const current = loadLocalData();
  const todayKey = getTodayKey();
  const updated: SystemData = {
    ...current,
    students,
    attendanceToday,
    attendanceHistory: {
      ...current.attendanceHistory,
      [todayKey]: attendanceToday,
    },
    scanLogOrder,
    scanLogTimes,
  };
  syncDataToCloud(updated);
}

export function saveScanLogData(
  scanLogOrder: string[],
  scanLogTimes: Record<string, string>
): void {
  const current = loadLocalData();
  const updated: SystemData = {
    ...current,
    scanLogOrder,
    scanLogTimes,
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

// -------------------------------------------------------------
// WhatsApp Pending Messages Outbox Management
// -------------------------------------------------------------

export function savePendingWhatsAppMessages(messages: PendingWhatsAppMessage[]): void {
  const current = loadLocalData();
  const updated: SystemData = { ...current, pendingWhatsAppMessages: messages };
  syncDataToCloud(updated);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("whatsapp-queue-updated", {
        detail: { count: messages.filter((m) => m.status === "pending").length },
      })
    );
  }
}

export function enqueuePendingWhatsAppMessage(
  item: Omit<PendingWhatsAppMessage, "id" | "createdAt" | "timeFormatted" | "status">
): PendingWhatsAppMessage {
  const current = loadLocalData();
  const now = new Date();
  const newMessage: PendingWhatsAppMessage = {
    ...item,
    id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: now.toISOString(),
    timeFormatted: formatTimeArabic(now),
    status: "pending",
  };

  const existing = current.pendingWhatsAppMessages || [];
  const updatedList = [newMessage, ...existing];
  savePendingWhatsAppMessages(updatedList);
  return newMessage;
}

export function enqueuePendingWhatsAppMessagesBatch(
  items: Array<Omit<PendingWhatsAppMessage, "id" | "createdAt" | "timeFormatted" | "status">>
): void {
  if (!items || items.length === 0) return;
  const current = loadLocalData();
  const now = new Date();
  const timeFormatted = formatTimeArabic(now);
  const createdAt = now.toISOString();

  const newMessages: PendingWhatsAppMessage[] = items.map((item, idx) => ({
    ...item,
    id: `wa_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt,
    timeFormatted,
    status: "pending",
  }));

  const existing = current.pendingWhatsAppMessages || [];
  const updatedList = [...newMessages, ...existing];
  savePendingWhatsAppMessages(updatedList);
}

export function markWhatsAppMessageSent(id: string): void {
  const current = loadLocalData();
  const existing = current.pendingWhatsAppMessages || [];
  const nowTime = formatTimeArabic();
  const updatedList = existing.map((m) =>
    m.id === id ? { ...m, status: "sent" as const, sentAt: nowTime } : m
  );
  savePendingWhatsAppMessages(updatedList);
}

export function markAllWhatsAppMessagesSent(): void {
  const current = loadLocalData();
  const existing = current.pendingWhatsAppMessages || [];
  const nowTime = formatTimeArabic();
  const updatedList = existing.map((m) =>
    m.status === "pending" ? { ...m, status: "sent" as const, sentAt: nowTime } : m
  );
  savePendingWhatsAppMessages(updatedList);
}

export function deletePendingWhatsAppMessage(id: string): void {
  const current = loadLocalData();
  const existing = current.pendingWhatsAppMessages || [];
  const updatedList = existing.filter((m) => m.id !== id);
  savePendingWhatsAppMessages(updatedList);
}

export function clearAllPendingWhatsAppMessages(): void {
  savePendingWhatsAppMessages([]);
}

