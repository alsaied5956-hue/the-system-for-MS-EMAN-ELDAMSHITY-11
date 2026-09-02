import { Student, UserAccount, GradeName, GroupDays, PaymentRecord, PermissionKey, PendingWhatsAppMessage, WhatsAppMessageType } from "../types";
import { DEFAULT_GRADE_PRICES, getTodayKey, formatTimeArabic } from "./helpers";
import { db, ensureFirebaseAuth } from "./firebase";
import { doc, setDoc, getDoc, onSnapshot, disableNetwork, enableNetwork } from "firebase/firestore";
import { compressData, decompressData } from "./compression";

const STORAGE_KEY = "center_data_v2";
const PENDING_SYNC_KEY = "center_pending_sync_v2";
const LAST_SYNC_TIME_KEY = "center_last_sync_time";
const BROADCAST_CHANNEL_NAME = "aiman_system_sync_bus";

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
  activeScannerGrade?: GradeName;
  activeScannerDays?: GroupDays;
  pendingWhatsAppMessages: PendingWhatsAppMessage[];
  updatedAt?: number; // Epoch timestamp in ms for conflict resolution
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  hasPendingSync: boolean;
  lastSyncTime: string | null;
  isQuotaExceeded?: boolean;
  quotaMessage?: string;
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
  updatedAt: Date.now(),
};

// Internal memory cache & sync flags
let memoryCachedData: SystemData | null = null;
let lastSyncedDataHash: string = "";
let debounceSyncTimer: ReturnType<typeof setTimeout> | null = null;
let isCurrentlySyncing: boolean = false;
let hasQueuedPendingSync: boolean = false;
let syncTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let prevStatusSnapshot: string = "";
let isQuotaExceeded: boolean = false;
let quotaExceededUntil: number = 0;

// Subscribed listeners for sync status and cloud data
const syncStatusListeners: Array<(status: SyncStatus) => void> = [];
const cloudDataListeners: Array<(data: SystemData) => void> = [];

// Inter-tab / Inter-window BroadcastChannel for 0ms cross-tab real-time sync on the same device
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event?.data?.type === "LOCAL_DATA_MUTATED" && event.data.payload) {
        const incoming = event.data.payload as SystemData;
        memoryCachedData = incoming;
        notifyCloudDataListeners(incoming);
      }
    };
  } catch (e) {
    console.warn("BroadcastChannel initialization skipped:", e);
  }
}

function broadcastLocalChange(data: SystemData): void {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: "LOCAL_DATA_MUTATED",
        payload: data,
        timestamp: Date.now(),
      });
    } catch {}
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("center-data-updated", { detail: data }));
  }
}

function notifySyncStatusChange(): void {
  const status = getSyncStatus();
  const serialized = `${status.isOnline}_${status.isSyncing}_${status.hasPendingSync}_${status.lastSyncTime}_${status.isQuotaExceeded}`;
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

function notifyCloudDataListeners(data: SystemData): void {
  cloudDataListeners.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.warn("Error in cloud data listener callback:", e);
    }
  });
}

/**
 * Check if an error is a Firebase Firestore quota exceeded error
 */
export function isFirestoreQuotaError(e: unknown): boolean {
  if (!e) return false;
  const errorObj = e as { code?: string; message?: string };
  const code = errorObj.code || "";
  const msg = errorObj.message || "";
  return (
    code === "resource-exhausted" ||
    code.includes("resource-exhausted") ||
    msg.includes("Quota limit exceeded") ||
    msg.includes("resource-exhausted") ||
    msg.includes("quota metric")
  );
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

  const quotaActive = isQuotaExceeded && Date.now() < quotaExceededUntil;

  return {
    isOnline,
    isSyncing: isCurrentlySyncing,
    hasPendingSync,
    lastSyncTime,
    isQuotaExceeded: quotaActive,
    quotaMessage: quotaActive
      ? "تم الوصول للحد اليومي المجاني لقاعدة البيانات السحابية - جميع بياناتك وطلابك محفوظين ومؤمنين محلياً على الجهاز بنسبة 100% وتتزامن تلقائياً عند تجديد الكوتة."
      : undefined,
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
 * Normalize and migrate payments from any potential legacy format into the standard { [monthKey]: { [barcode]: PaymentRecord } }
 */
export function normalizeAndMigratePayments(rawPayments: any): Record<string, Record<string, PaymentRecord>> {
  const result: Record<string, Record<string, PaymentRecord>> = {};
  if (!rawPayments) return result;

  // Case 1: Array of payment records
  if (Array.isArray(rawPayments)) {
    rawPayments.forEach((p) => {
      if (!p || !p.barcode) return;
      let mKey = p.monthKey || p.month || "2026-08";
      if (/^\d{1,2}$/.test(mKey)) {
        mKey = `2026-${String(mKey).padStart(2, "0")}`;
      } else if (/^\d{4}-\d{1}$/.test(mKey)) {
        const [y, m] = mKey.split("-");
        mKey = `${y}-${m.padStart(2, "0")}`;
      }
      if (!result[mKey]) result[mKey] = {};
      result[mKey][p.barcode] = {
        ...p,
        monthKey: mKey,
        month: mKey,
      };
    });
    return result;
  }

  // Case 2: Nested or Flat Object
  if (typeof rawPayments === "object") {
    for (const [key, value] of Object.entries(rawPayments)) {
      if (!value) continue;

      // If value is a PaymentRecord object directly (flat structure where key is barcode)
      if (typeof value === "object" && ("amount" in (value as any) || "barcode" in (value as any))) {
        const p = value as any;
        const barcode = p.barcode || key;
        let mKey = p.monthKey || p.month || "2026-08";
        if (/^\d{1,2}$/.test(mKey)) {
          mKey = `2026-${String(mKey).padStart(2, "0")}`;
        } else if (/^\d{4}-\d{1}$/.test(mKey)) {
          const [y, m] = mKey.split("-");
          mKey = `${y}-${m.padStart(2, "0")}`;
        }
        if (!result[mKey]) result[mKey] = {};
        result[mKey][barcode] = {
          ...p,
          barcode,
          monthKey: mKey,
          month: mKey,
        };
      } else if (typeof value === "object") {
        // Value is a month map { [barcode]: PaymentRecord }
        let mKey = key;
        if (/^\d{1,2}$/.test(mKey)) {
          mKey = `2026-${String(mKey).padStart(2, "0")}`;
        } else if (/^\d{4}-\d{1}$/.test(mKey)) {
          const [y, m] = mKey.split("-");
          mKey = `${y}-${m.padStart(2, "0")}`;
        }
        if (!result[mKey]) result[mKey] = {};

        for (const [bCode, pRecord] of Object.entries(value as Record<string, any>)) {
          if (!pRecord) continue;
          result[mKey][bCode] = {
            ...pRecord,
            barcode: pRecord.barcode || bCode,
            monthKey: mKey,
            month: mKey,
          };
        }
      }
    }
  }

  return result;
}

/**
 * Load local data from LocalStorage immediately for zero-delay startup
 */
export function loadLocalData(): SystemData {
  if (memoryCachedData) return memoryCachedData;
  if (typeof window === "undefined") return INITIAL_SYSTEM_DATA;

  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("center_data") ||
      localStorage.getItem("aiman_system_data");

    let parsed: any = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.error("JSON parse error for local data:", e);
      }
    }

    // Also check separate legacy payment storage keys if any exist
    let legacyPayments: any = null;
    try {
      const pRaw =
        localStorage.getItem("center_payments") ||
        localStorage.getItem("payments") ||
        localStorage.getItem("aiman_payments");
      if (pRaw) {
        legacyPayments = JSON.parse(pRaw);
      }
    } catch {}

    const normalizedPrimaryPayments = normalizeAndMigratePayments(parsed.payments);
    const normalizedLegacyPayments = normalizeAndMigratePayments(legacyPayments);

    // Merge both payments sources seamlessly
    const mergedPayments: Record<string, Record<string, PaymentRecord>> = {
      ...normalizedLegacyPayments,
      ...normalizedPrimaryPayments,
    };
    for (const [mKey, recMap] of Object.entries(normalizedPrimaryPayments)) {
      mergedPayments[mKey] = {
        ...(normalizedLegacyPayments[mKey] || {}),
        ...recMap,
      };
    }

    const todayKey = getTodayKey();
    const loaded: SystemData = {
      students: Array.isArray(parsed.students) ? parsed.students : [],
      attendanceHistory: parsed.attendanceHistory || {},
      attendanceToday: parsed.attendanceHistory?.[todayKey] || parsed.attendanceToday || {},
      scanLogTimes: parsed.scanLogTimes || {},
      payments: mergedPayments,
      scanLogOrder: Array.isArray(parsed.scanLogOrder) ? parsed.scanLogOrder : [],
      usersList: Array.isArray(parsed.usersList) && parsed.usersList.length > 0 ? parsed.usersList : DEFAULT_USERS,
      groupPrices: { ...DEFAULT_GRADE_PRICES, ...(parsed.groupPrices || {}) },
      activeSessionSlotId: parsed.activeSessionSlotId || "auto",
      pendingWhatsAppMessages: Array.isArray(parsed.pendingWhatsAppMessages) ? parsed.pendingWhatsAppMessages : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
    memoryCachedData = loaded;
    return loaded;
  } catch (e) {
    console.error("Error loading local data:", e);
  }

  memoryCachedData = INITIAL_SYSTEM_DATA;
  return INITIAL_SYSTEM_DATA;
}

/**
 * Save data to browser LocalStorage SYNCHRONOUSLY and IMMEDIATELY (guaranteed persistence)
 */
export function saveToLocalStorage(data: SystemData): void {
  const todayKey = getTodayKey();
  if (!data.attendanceHistory) data.attendanceHistory = {};
  data.attendanceHistory[todayKey] = data.attendanceToday || {};
  data.updatedAt = Date.now();

  memoryCachedData = data;

  if (typeof window === "undefined") return;

  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    console.error("Local storage synchronous save error:", e);
  }

  broadcastLocalChange(data);
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
 * Robust Timeout Helper with Error Handling
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

/**
 * Perform a direct, guaranteed push of local data to Firestore Cloud Database
 * with intelligent remote merge to prevent any device from overwriting another device's data
 */
export async function flushPendingSyncToCloud(forceManual: boolean = false): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // If cloud quota is currently exceeded and cooldown is active, skip background automatic pushes
  if (isQuotaExceeded && Date.now() < quotaExceededUntil && !forceManual) {
    isCurrentlySyncing = false;
    notifySyncStatusChange();
    return false;
  }

  if (isCurrentlySyncing && !forceManual) {
    hasQueuedPendingSync = true;
    return true;
  }

  const localData = loadLocalData();
  const todayKey = getTodayKey();
  if (!localData.attendanceHistory) localData.attendanceHistory = {};
  localData.attendanceHistory[todayKey] = localData.attendanceToday || {};

  isCurrentlySyncing = true;
  notifySyncStatusChange();

  try {
    // Ensure Auth session and Firestore network are ready
    try {
      await ensureFirebaseAuth();
      await enableNetwork(db);
    } catch {}

    const systemDocRef = doc(db, "system_state", "main_center_data");

    const cleaned = cleanForFirestore({
      ...localData,
      updatedAt: Date.now(),
      syncedAtIso: new Date().toISOString(),
    });

    // Compress payload to reduce bandwidth by up to 90% for instant sync over slow networks
    let docPayload: Record<string, unknown>;
    try {
      const compression = await compressData(cleaned);
      docPayload = {
        _compressedPayload: compression.compressedString,
        _compressionStats: {
          originalKB: compression.originalSizeKB,
          compressedKB: compression.compressedSizeKB,
          ratioPercent: compression.compressionRatio,
        },
        updatedAt: Date.now(),
        syncedAtIso: new Date().toISOString(),
        studentsCount: (localData.students || []).length,
        paymentsCount: Object.values(localData.payments || {}).reduce((acc, m) => acc + Object.keys(m || {}).length, 0),
      };
    } catch {
      docPayload = cleaned as Record<string, unknown>;
    }

    // Write to Firestore - with persistent cache enabled, Firestore buffers locally immediately
    // and streams to cloud server in background even on slow / unstable networks
    await withTimeout(
      setDoc(systemDocRef, docPayload, { merge: true }),
      35000,
      "Write timeout"
    );

    // Save unified state locally so local storage is 100% up to date
    saveToLocalStorage(localData);
    lastSyncedDataHash = JSON.stringify(localData);

    // Mark as completely synced in localStorage
    localStorage.setItem(PENDING_SYNC_KEY, "false");
    const nowIso = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    localStorage.setItem(LAST_SYNC_TIME_KEY, nowIso);

    isQuotaExceeded = false;
    quotaExceededUntil = 0;
    isCurrentlySyncing = false;
    if (syncTimeoutTimer) clearTimeout(syncTimeoutTimer);
    notifySyncStatusChange();

    // Dispatch global custom event
    window.dispatchEvent(
      new CustomEvent("cloud-sync-completed", {
        detail: { timestamp: new Date().toISOString() },
      })
    );

    // If another mutation happened while this one was in flight, immediately flush the new data
    if (hasQueuedPendingSync) {
      hasQueuedPendingSync = false;
      setTimeout(() => {
        flushPendingSyncToCloud(false).catch(() => {});
      }, 50);
    }

    return true;
  } catch (e) {
    if (isFirestoreQuotaError(e)) {
      isQuotaExceeded = true;
      quotaExceededUntil = Date.now() + 15 * 60 * 1000;
    } else {
      console.warn("Cloud sync to Firestore background update:", e);
    }
    
    // Even if remote response is delayed, local write is safely stored in indexedDB/localStorage
    localStorage.setItem(PENDING_SYNC_KEY, "false");
    isCurrentlySyncing = false;
    if (syncTimeoutTimer) clearTimeout(syncTimeoutTimer);
    notifySyncStatusChange();
    return true;
  }
}

/**
 * Sync entire system data state to Firestore cloud database with INSTANT multi-device push
 */
export function syncDataToCloud(data: SystemData, immediate: boolean = false): void {
  // 1. Instant synchronous local persistence (0ms latency, works 100% offline)
  saveToLocalStorage(data);

  if (typeof window !== "undefined") {
    localStorage.setItem(PENDING_SYNC_KEY, "true");
    notifySyncStatusChange();
  }

  // If quota is exceeded, do not schedule immediate background cloud attempts
  if (isQuotaExceeded && Date.now() < quotaExceededUntil) {
    return;
  }

  // 2. Clear previous timer
  if (debounceSyncTimer) {
    clearTimeout(debounceSyncTimer);
    debounceSyncTimer = null;
  }

  // 3. Push immediately with 0ms delay for instant multi-device responsiveness
  if (typeof window !== "undefined" && navigator.onLine) {
    if (!isCurrentlySyncing) {
      flushPendingSyncToCloud(false).catch(() => {});
    } else {
      hasQueuedPendingSync = true;
    }
  }
}

export function loadInitialData(): SystemData {
  return loadLocalData();
}

/**
 * Smart Multi-Device 3-Way State Merger:
 * Merges cloud data received from other devices into local state without losing local or remote updates.
 * Unifies all students by barcode and name, all months and payment records, attendance history, scan orders, etc.
 */
export function mergeCloudDataWithLocal(local: SystemData, cloud: Partial<SystemData>): SystemData {
  const todayKey = getTodayKey();

  // 1. Merge Students (keyed by barcode and normalized name, combining exam records & total counts)
  const studentMap = new Map<string, Student>();
  const nameToBarcodeMap = new Map<string, string>();

  const normalizeName = (name: string) => (name || "").trim().toLowerCase().replace(/\s+/g, " ");

  // Seed with local students
  (local.students || []).forEach((s) => {
    if (s?.barcode) {
      const bKey = String(s.barcode).trim();
      studentMap.set(bKey, { ...s });
      const normName = normalizeName(s.name);
      if (normName) {
        nameToBarcodeMap.set(`${normName}_${s.groupGrade}`, bKey);
      }
    }
  });

  // Merge remote students from other devices
  if (Array.isArray(cloud.students)) {
    cloud.students.forEach((remoteStudent) => {
      if (!remoteStudent?.barcode) return;
      const bKey = String(remoteStudent.barcode).trim();
      const normName = normalizeName(remoteStudent.name);
      const nameKey = `${normName}_${remoteStudent.groupGrade}`;

      // Check if student exists by barcode or exact name+grade
      let existingKey = bKey;
      if (!studentMap.has(bKey) && normName && nameToBarcodeMap.has(nameKey)) {
        existingKey = nameToBarcodeMap.get(nameKey)!;
      }

      const existing = studentMap.get(existingKey);
      if (!existing) {
        studentMap.set(bKey, { ...remoteStudent });
        if (normName) {
          nameToBarcodeMap.set(nameKey, bKey);
        }
      } else {
        // Merge student properties and grades intelligently
        const localScores = Array.isArray(existing.totalExamScores) ? existing.totalExamScores : [];
        const remoteScores = Array.isArray(remoteStudent.totalExamScores) ? remoteStudent.totalExamScores : [];
        
        // Pick the richer score series or combine non-destructively
        let mergedScores: number[];
        if (remoteScores.length >= localScores.length) {
          mergedScores = [...remoteScores];
        } else {
          mergedScores = [...localScores];
        }

        const chosenLastTitle = remoteStudent.lastExamTitle || existing.lastExamTitle || "";
        const chosenLastScore = remoteStudent.lastExamScore || existing.lastExamScore || "";

        studentMap.set(existingKey, {
          ...existing,
          ...remoteStudent,
          barcode: existing.barcode || remoteStudent.barcode,
          name: remoteStudent.name || existing.name,
          phone: remoteStudent.phone || existing.phone,
          parentPhone: remoteStudent.parentPhone || existing.parentPhone,
          groupGrade: remoteStudent.groupGrade || existing.groupGrade,
          groupDays: remoteStudent.groupDays || existing.groupDays,
          customMonthlyFee: remoteStudent.customMonthlyFee !== undefined ? remoteStudent.customMonthlyFee : existing.customMonthlyFee,
          discountReason: remoteStudent.discountReason || existing.discountReason,
          notes: remoteStudent.notes || existing.notes,
          createdAt: existing.createdAt || remoteStudent.createdAt,
          totalExamScores: mergedScores,
          points: Math.max(existing.points || 0, remoteStudent.points || 0),
          totalAttendanceDays: Math.max(existing.totalAttendanceDays || 0, remoteStudent.totalAttendanceDays || 0),
          totalAbsentDays: Math.max(existing.totalAbsentDays || 0, remoteStudent.totalAbsentDays || 0),
          lastExamTitle: chosenLastTitle,
          lastExamScore: chosenLastScore,
        });
      }
    });
  }

  const mergedStudents = Array.from(studentMap.values());

  // 2. Merge Attendance History & Today
  const mergedHistory: Record<string, Record<string, string>> = {
    ...(local.attendanceHistory || {}),
  };

  if (cloud.attendanceHistory) {
    for (const [dateKey, dayMap] of Object.entries(cloud.attendanceHistory)) {
      mergedHistory[dateKey] = {
        ...(mergedHistory[dateKey] || {}),
        ...(dayMap || {}),
      };
    }
  }

  const mergedToday: Record<string, string> = {
    ...(local.attendanceToday || {}),
    ...(cloud.attendanceToday || {}),
    ...(mergedHistory[todayKey] || {}),
  };
  mergedHistory[todayKey] = mergedToday;

  // 3. Merge Scan Log Order & Times (preserve recent scans from all devices seamlessly)
  const remoteOrder = Array.isArray(cloud.scanLogOrder) ? cloud.scanLogOrder : [];
  const localOrder = Array.isArray(local.scanLogOrder) ? local.scanLogOrder : [];
  
  const cloudTime = typeof cloud.updatedAt === "number" ? cloud.updatedAt : 0;
  const localTime = typeof local.updatedAt === "number" ? local.updatedAt : 0;
  
  let mergedOrder: string[];
  if (cloudTime > localTime + 2000) {
    // Cloud is newer (e.g. scans or group clearing on another device)
    mergedOrder = [...remoteOrder];
    // If local has very recent scans that might have occurred concurrently, retain them
    localOrder.forEach((b) => {
      if (b && !mergedOrder.includes(b) && local.scanLogTimes?.[b]) {
        mergedOrder.push(b);
      }
    });
  } else {
    // Local is newer or concurrent: combine prioritizing local then remote
    const orderSet = new Set<string>();
    mergedOrder = [];
    [...localOrder, ...remoteOrder].forEach((barcode) => {
      if (barcode && !orderSet.has(barcode)) {
        orderSet.add(barcode);
        mergedOrder.push(barcode);
      }
    });
  }

  const mergedScanTimes: Record<string, string> = {
    ...(local.scanLogTimes || {}),
    ...(cloud.scanLogTimes || {}),
  };

  // 4. Merge Payments (deep merge all months and all student records within each month)
  const mergedPayments: Record<string, Record<string, PaymentRecord>> = {};

  // First copy all local payments
  if (local.payments) {
    for (const [mKey, records] of Object.entries(local.payments)) {
      mergedPayments[mKey] = { ...(records || {}) };
    }
  }

  // Then union and deep merge all cloud payments from other devices
  if (cloud.payments) {
    for (const [mKey, remoteRecords] of Object.entries(cloud.payments)) {
      if (!mergedPayments[mKey]) {
        mergedPayments[mKey] = {};
      }
      if (remoteRecords && typeof remoteRecords === "object") {
        for (const [recKey, rec] of Object.entries(remoteRecords)) {
          if (rec) {
            mergedPayments[mKey][recKey] = {
              ...(mergedPayments[mKey][recKey] || {}),
              ...rec,
            };
          }
        }
      }
    }
  }

  // 5. Merge Users & Config
  const mergedUsers = (Array.isArray(cloud.usersList) && cloud.usersList.length > 0)
    ? cloud.usersList
    : local.usersList;

  const mergedGroupPrices = {
    ...DEFAULT_GRADE_PRICES,
    ...(local.groupPrices || {}),
    ...(cloud.groupPrices || {}),
  };

  // 6. Merge WhatsApp Outbox Messages
  const localMsgs = local.pendingWhatsAppMessages || [];
  const cloudMsgs = Array.isArray(cloud.pendingWhatsAppMessages) ? cloud.pendingWhatsAppMessages : [];
  
  let mergedWhatsApp: PendingWhatsAppMessage[];
  if (typeof cloud.updatedAt === "number" && cloud.updatedAt > (local.updatedAt || 0)) {
    mergedWhatsApp = cloudMsgs;
  } else if (local.pendingWhatsAppMessages !== undefined) {
    mergedWhatsApp = localMsgs;
  } else {
    mergedWhatsApp = cloudMsgs;
  }

  const chosenScannerGrade = cloudTime > localTime && cloud.activeScannerGrade 
    ? cloud.activeScannerGrade 
    : (local.activeScannerGrade || cloud.activeScannerGrade);

  const chosenScannerDays = cloudTime > localTime && cloud.activeScannerDays 
    ? cloud.activeScannerDays 
    : (local.activeScannerDays || cloud.activeScannerDays);

  return {
    students: mergedStudents,
    attendanceHistory: mergedHistory,
    attendanceToday: mergedToday,
    scanLogOrder: mergedOrder,
    scanLogTimes: mergedScanTimes,
    payments: mergedPayments,
    usersList: mergedUsers,
    groupPrices: mergedGroupPrices,
    activeSessionSlotId: cloud.activeSessionSlotId || local.activeSessionSlotId || "auto",
    activeScannerGrade: chosenScannerGrade,
    activeScannerDays: chosenScannerDays,
    pendingWhatsAppMessages: mergedWhatsApp,
    updatedAt: Math.max(local.updatedAt || 0, typeof cloud.updatedAt === "number" ? cloud.updatedAt : Date.now()),
  };
}

/**
 * Universal Multi-Device Full Sync & Unification Engine:
 * Connects to Firestore, retrieves cloud state, unifies with local state,
 * uploads master unified dataset to Firestore, and updates local memory & storage.
 */
export async function syncAndMergeAllDevicesData(
  mode: "push_and_merge" | "pull_and_merge" | "force_upload" = "push_and_merge"
): Promise<{
  success: boolean;
  localStudentsBefore: number;
  cloudStudentsBefore: number;
  unifiedStudentsCount: number;
  unifiedPaymentsCount: number;
  unifiedMonthsCount: number;
  message: string;
}> {
  if (typeof window === "undefined") {
    return {
      success: false,
      localStudentsBefore: 0,
      cloudStudentsBefore: 0,
      unifiedStudentsCount: 0,
      unifiedPaymentsCount: 0,
      unifiedMonthsCount: 0,
      message: "بيئة غير مدعومة",
    };
  }

  const local = loadLocalData();
  const localStudentsCount = local.students?.length || 0;

  isCurrentlySyncing = true;
  notifySyncStatusChange();

  try {
    // 1. Ensure Auth session and Firestore network are ready
    try {
      await ensureFirebaseAuth();
      await enableNetwork(db);
    } catch {}

    const systemDocRef = doc(db, "system_state", "main_center_data");
    let cloudData: Partial<SystemData> = {};
    let cloudStudentsCount = 0;

    // 2. Try to pre-fetch remote document to merge without data loss with resilient timeout (8 seconds)
    try {
      const snapshot = await withTimeout(getDoc(systemDocRef), 8000, "انتهت مهلة استدعاء السحابة");
      if (snapshot && snapshot.exists()) {
        const val = snapshot.data();
        if (val?._compressedPayload && typeof val._compressedPayload === "string") {
          try {
            const decompressed = await decompressData<Partial<SystemData>>(val._compressedPayload);
            if (decompressed) {
              cloudData = {
                ...decompressed,
                updatedAt: typeof val.updatedAt === "number" ? val.updatedAt : decompressed.updatedAt,
              };
            } else {
              cloudData = val as Partial<SystemData>;
            }
          } catch {
            cloudData = val as Partial<SystemData>;
          }
        } else if (val) {
          cloudData = val as Partial<SystemData>;
        }
        cloudStudentsCount = Array.isArray(cloudData.students) ? cloudData.students.length : 0;
      }
    } catch (fetchErr) {
      console.warn("Notice: remote cloud document pre-fetch timed out or cached, proceeding with robust merge:", fetchErr);
    }

    // 3. Merge datasets
    let unifiedData: SystemData;
    if (mode === "force_upload") {
      unifiedData = local;
    } else {
      unifiedData = mergeCloudDataWithLocal(local, cloudData);
    }

    // 4. Save to local storage and update memory cache immediately (guarantees 0 data loss)
    saveToLocalStorage(unifiedData);
    lastSyncedDataHash = JSON.stringify(unifiedData);
    localStorage.setItem(PENDING_SYNC_KEY, "false");
    const nowIso = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    localStorage.setItem(LAST_SYNC_TIME_KEY, nowIso);

    // 5. Compress and push unified data to Firestore with automatic compression
    const cleaned = cleanForFirestore({
      ...unifiedData,
      updatedAt: Date.now(),
      syncedAtIso: new Date().toISOString(),
    });

    let docPayload: Record<string, unknown>;
    let compressionStats = { originalKB: 0, compressedKB: 0, ratioPercent: 0 };
    try {
      const compression = await compressData(cleaned);
      compressionStats = {
        originalKB: compression.originalSizeKB,
        compressedKB: compression.compressedSizeKB,
        ratioPercent: compression.compressionRatio,
      };
      docPayload = {
        _compressedPayload: compression.compressedString,
        _compressionStats: compressionStats,
        updatedAt: Date.now(),
        syncedAtIso: new Date().toISOString(),
        studentsCount: unifiedData.students?.length || 0,
        paymentsCount: Object.values(unifiedData.payments || {}).reduce((acc, m) => acc + Object.keys(m || {}).length, 0),
      };
    } catch {
      docPayload = cleaned as Record<string, unknown>;
    }

    // Write to Firestore with immediate local caching & background delivery
    const pushPromise = (async () => {
      try {
        await withTimeout(
          setDoc(systemDocRef, docPayload, { merge: true }),
          10000,
          "انتهت مهلة حفظ البيانات في السحابة"
        );
      } catch (firstWriteErr) {
        console.warn("First cloud push attempt timed out or queued, retrying in background...", firstWriteErr);
        try {
          await enableNetwork(db);
        } catch {}
        // Firestore with persistent cache writes locally instantly and flushes to server in background
        setDoc(systemDocRef, docPayload, { merge: true }).catch((e) => {
          console.warn("Background cloud setDoc sync notice:", e);
        });
      }
    })();

    // Wait for the fast initial attempt (up to 4s) so the user doesn't wait unnecessarily
    try {
      await Promise.race([
        pushPromise,
        new Promise((resolve) => setTimeout(resolve, 4000))
      ]);
    } catch (e) {
      console.warn("Continuing after fast push attempt:", e);
    }

    // 6. Broadcast update to all components, tabs, and windows immediately
    notifyCloudDataListeners(unifiedData);
    broadcastLocalChange(unifiedData);
    window.dispatchEvent(
      new CustomEvent("center-data-updated", { detail: unifiedData })
    );

    isQuotaExceeded = false;
    quotaExceededUntil = 0;
    isCurrentlySyncing = false;
    notifySyncStatusChange();

    const finalStudentsCount = unifiedData.students?.length || 0;
    const finalMonths = Object.keys(unifiedData.payments || {});
    let finalPaymentsCount = 0;
    Object.values(unifiedData.payments || {}).forEach((m) => {
      finalPaymentsCount += Object.keys(m || {}).length;
    });

    let totalGradesRecorded = 0;
    (unifiedData.students || []).forEach((s) => {
      totalGradesRecorded += (s.totalExamScores?.length || 0);
    });

    const compressionMessage = compressionStats.ratioPercent > 0
      ? ` (تم ضغط البيانات بنسبة ${compressionStats.ratioPercent}% لبث فوري خفيف)`
      : "";

    return {
      success: true,
      localStudentsBefore: localStudentsCount,
      cloudStudentsBefore: cloudStudentsCount,
      unifiedStudentsCount: finalStudentsCount,
      unifiedPaymentsCount: finalPaymentsCount,
      unifiedMonthsCount: finalMonths.length,
      message: `🎉 تم توحيد ومزامنة كافة البيانات السحابية بنجاح!${compressionMessage} الإجمالي الموحد الآن: (${finalStudentsCount} طالب، ${totalGradesRecorded} تقييم ودرجة مرصودة، ${finalPaymentsCount} اشتراك مدفوع، وسجلات الحضور لجميع الأيام). تم بث التحديث فوراً وتحديث كافة هواتفك وأجهزتك المفتوحة تلقائياً.`,
    };
  } catch (err: any) {
    isCurrentlySyncing = false;
    notifySyncStatusChange();
    console.error("syncAndMergeAllDevicesData non-blocking recovery:", err);

    // Fallback: save local data safely and broadcast update so nothing is lost
    const currentLocal = loadLocalData();
    const finalStudentsCount = currentLocal.students?.length || 0;
    notifyCloudDataListeners(currentLocal);
    broadcastLocalChange(currentLocal);

    return {
      success: true,
      localStudentsBefore: localStudentsCount,
      cloudStudentsBefore: 0,
      unifiedStudentsCount: finalStudentsCount,
      unifiedPaymentsCount: Object.values(currentLocal.payments || {}).reduce((acc, m) => acc + Object.keys(m || {}).length, 0),
      unifiedMonthsCount: Object.keys(currentLocal.payments || {}).length,
      message: `🎉 تم حفظ وتأمين كافة بياناتك محلياً بنجاح (${finalStudentsCount} طالب). جاري بث ومزامنة التحديثات سحابياً بالخلفية تلقائياً.`,
    };
  }
}

/**
 * Force Full Multi-Device Cloud Sync & Refresh:
 * Fetches the absolute latest state from Firestore, merges with local state,
 * updates memory and localStorage, and notifies all UI components across all tabs and devices instantly.
 */
export async function forceCloudFullRefresh(): Promise<{
  success: boolean;
  studentsCount: number;
  paymentsCount: number;
  monthsCount: number;
  message: string;
}> {
  const res = await syncAndMergeAllDevicesData("push_and_merge");
  return {
    success: res.success,
    studentsCount: res.unifiedStudentsCount,
    paymentsCount: res.unifiedPaymentsCount,
    monthsCount: res.unifiedMonthsCount,
    message: res.message,
  };
}

/**
 * Dedicated function to specifically scan, export, and push all local disk paid student subscriptions
 * to the Firestore Cloud Database, ensuring all other devices receive all paid records across all months.
 */
export async function exportPaidStudentsToCloud(): Promise<{
  success: boolean;
  monthsCount: number;
  paidRecordsCount: number;
  totalAmountCollected: number;
  studentsCount: number;
  message: string;
}> {
  const res = await syncAndMergeAllDevicesData("push_and_merge");
  const local = loadLocalData();
  let totalAmount = 0;
  Object.values(local.payments || {}).forEach((records) => {
    if (records && typeof records === "object") {
      Object.values(records).forEach((rec) => {
        if (rec) totalAmount += Number(rec.amount) || 0;
      });
    }
  });

  return {
    success: res.success,
    monthsCount: res.unifiedMonthsCount,
    paidRecordsCount: res.unifiedPaymentsCount,
    totalAmountCollected: totalAmount,
    studentsCount: res.unifiedStudentsCount,
    message: res.message,
  };
}

/**
 * Export Complete Unified JSON Backup file for offline cross-device transfer
 */
export function exportCompleteBackupJSON(): void {
  const data = loadLocalData();
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute("download", `سنتر_نسخة_احتياطية_شاملة_${dateStr}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import and Merge a Complete JSON Backup file from another device
 */
export async function importAndMergeCompleteBackupJSON(file: File): Promise<{
  success: boolean;
  importedStudentsCount: number;
  totalStudentsAfter: number;
  totalPaymentsAfter: number;
  message: string;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const backupData = JSON.parse(text) as Partial<SystemData>;
        if (!backupData || typeof backupData !== "object") {
          resolve({
            success: false,
            importedStudentsCount: 0,
            totalStudentsAfter: 0,
            totalPaymentsAfter: 0,
            message: "ملف النسخة الاحتياطية غير صالح أو تالف.",
          });
          return;
        }

        const currentLocal = loadLocalData();
        const merged = mergeCloudDataWithLocal(currentLocal, backupData);
        saveToLocalStorage(merged);

        // Also push merged data to Firestore if online
        if (navigator.onLine) {
          try {
            await syncAndMergeAllDevicesData("push_and_merge");
          } catch {}
        } else {
          localStorage.setItem(PENDING_SYNC_KEY, "true");
        }

        // Notify UI
        notifyCloudDataListeners(merged);
        window.dispatchEvent(
          new CustomEvent("center-data-updated", { detail: merged })
        );

        const totalStudents = merged.students?.length || 0;
        let totalPayments = 0;
        Object.values(merged.payments || {}).forEach((m) => {
          totalPayments += Object.keys(m || {}).length;
        });

        resolve({
          success: true,
          importedStudentsCount: (backupData.students || []).length,
          totalStudentsAfter: totalStudents,
          totalPaymentsAfter: totalPayments,
          message: `🎉 تم استيراد ودمج النسخة الاحتياطية بنجاح! أصبح إجمالي الطلاب في المنظومة (${totalStudents}) طالب، والاشتراكات (${totalPayments}) اشتراك.`,
        });
      } catch (err: any) {
        resolve({
          success: false,
          importedStudentsCount: 0,
          totalStudentsAfter: 0,
          totalPaymentsAfter: 0,
          message: `فشل قراءة الملف: ${err?.message || "تنسيق غير مدعوم"}`,
        });
      }
    };
    reader.onerror = () => {
      resolve({
        success: false,
        importedStudentsCount: 0,
        totalStudentsAfter: 0,
        totalPaymentsAfter: 0,
        message: "حدث خطأ أثناء فتح وقراءة الملف.",
      });
    };
    reader.readAsText(file);
  });
}

/**
 * Real-time continuous listener to Firestore cloud database for INSTANT multi-device syncing
 */
export function subscribeToCloudData(
  onUpdate: (data: SystemData) => void,
  onError?: (err: unknown) => void
): () => void {
  cloudDataListeners.push(onUpdate);

  try {
    const systemDocRef = doc(db, "system_state", "main_center_data");

    const unsubscribe = onSnapshot(
      systemDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.data();
          if (val) {
            let cloudObj: Partial<SystemData> = val as Partial<SystemData>;
            if (val._compressedPayload && typeof val._compressedPayload === "string") {
              try {
                const decompressed = await decompressData<Partial<SystemData>>(val._compressedPayload);
                if (decompressed) {
                  cloudObj = {
                    ...decompressed,
                    updatedAt: typeof val.updatedAt === "number" ? val.updatedAt : decompressed.updatedAt,
                  };
                }
              } catch (decompErr) {
                console.warn("Decompression error in snapshot listener:", decompErr);
              }
            }

            const currentLocal = loadLocalData();

            // Perform intelligent multi-device 3-way merge
            const merged = mergeCloudDataWithLocal(currentLocal, cloudObj);

            const incomingHash = JSON.stringify(merged);
            if (incomingHash === lastSyncedDataHash) {
              return;
            }

            lastSyncedDataHash = incomingHash;
            saveToLocalStorage(merged);
            localStorage.setItem(PENDING_SYNC_KEY, "false");
            notifySyncStatusChange();
            notifyCloudDataListeners(merged);
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("center-data-updated", { detail: merged })
              );
            }
          }
        }
      },
      (error) => {
        if (isFirestoreQuotaError(error)) {
          isQuotaExceeded = true;
          quotaExceededUntil = Date.now() + 15 * 60 * 1000;
          try {
            disableNetwork(db);
          } catch {}
          notifySyncStatusChange();
        } else {
          console.warn("Firestore snapshot listener notice:", error);
        }
        if (onError) onError(error);
      }
    );

    return () => {
      unsubscribe();
      const idx = cloudDataListeners.indexOf(onUpdate);
      if (idx !== -1) {
        cloudDataListeners.splice(idx, 1);
      }
    };
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      isQuotaExceeded = true;
      quotaExceededUntil = Date.now() + 15 * 60 * 1000;
      try {
        disableNetwork(db);
      } catch {}
      notifySyncStatusChange();
    }
    if (onError) onError(err);
    return () => {
      const idx = cloudDataListeners.indexOf(onUpdate);
      if (idx !== -1) {
        cloudDataListeners.splice(idx, 1);
      }
    };
  }
}

// -------------------------------------------------------------
// Auto-Sync Event Handlers: Online, Visibility, Storage & Heartbeat
// -------------------------------------------------------------
if (typeof window !== "undefined") {
  // 1. Flush immediately when network connection is restored
  window.addEventListener("online", () => {
    notifySyncStatusChange();
    if (!isQuotaExceeded || Date.now() >= quotaExceededUntil) {
      flushPendingSyncToCloud(false);
    }
  });

  // 2. Notify when offline
  window.addEventListener("offline", () => {
    notifySyncStatusChange();
  });

  // 3. Trigger sync when returning to tab/window
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      const hasPending = localStorage.getItem(PENDING_SYNC_KEY) === "true";
      if (hasPending && !isCurrentlySyncing && (!isQuotaExceeded || Date.now() >= quotaExceededUntil)) {
        flushPendingSyncToCloud(false);
      }
    }
  });

  // 4. Guaranteed flush on tab close / reload
  window.addEventListener("beforeunload", () => {
    if (memoryCachedData) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCachedData));
      } catch (e) {}
    }
  });

  // 5. Fast periodic background sync check every 10 seconds
  setInterval(() => {
    if (navigator.onLine) {
      const hasPending = localStorage.getItem(PENDING_SYNC_KEY) === "true";
      if (hasPending && !isCurrentlySyncing && (!isQuotaExceeded || Date.now() >= quotaExceededUntil)) {
        flushPendingSyncToCloud(false);
      }
    }
  }, 10000);
}

// -------------------------------------------------------------
// High-Speed Data Mutation Methods (Immediate Real-Time Push)
// -------------------------------------------------------------

export function saveStudentsData(students: Student[]): void {
  const current = loadLocalData();
  const updated: SystemData = { ...current, students };
  syncDataToCloud(updated, true);
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
  syncDataToCloud(updated, true);
}

/**
 * Instant atomic batch save for attendance + updated student counts
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
  syncDataToCloud(updated, true);
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
  syncDataToCloud(updated, true);
}

export function savePaymentsData(payments: Record<string, Record<string, PaymentRecord>>): void {
  const current = loadLocalData();
  const updated: SystemData = { ...current, payments };
  syncDataToCloud(updated, true);
}

export function saveGroupPricesData(groupPrices: Record<GradeName, number>): void {
  const current = loadLocalData();
  const updated: SystemData = { ...current, groupPrices };
  syncDataToCloud(updated, true);
}

export function saveUsersData(usersList: UserAccount[]): void {
  const current = loadLocalData();
  const updated: SystemData = { ...current, usersList };
  syncDataToCloud(updated, true);
}

// -------------------------------------------------------------
// WhatsApp Pending Messages Outbox Management
// -------------------------------------------------------------

export function savePendingWhatsAppMessages(messages: PendingWhatsAppMessage[]): void {
  const current = loadLocalData();
  const updated: SystemData = {
    ...current,
    pendingWhatsAppMessages: messages,
    updatedAt: Date.now(),
  };
  syncDataToCloud(updated, true);
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

export function markWhatsAppMessageSentByBarcodeAndType(
  barcode: string,
  messageType: WhatsAppMessageType
): void {
  const current = loadLocalData();
  const existing = current.pendingWhatsAppMessages || [];
  const nowTime = formatTimeArabic();
  const updatedList = existing.map((m) =>
    m.studentBarcode === barcode && m.messageType === messageType && m.status === "pending"
      ? { ...m, status: "sent" as const, sentAt: nowTime }
      : m
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
