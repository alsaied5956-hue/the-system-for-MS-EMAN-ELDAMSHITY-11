import React, { useState, useRef, useEffect, useMemo } from "react";
import { Student, GradeName, GroupDays, PaymentRecord, GRADE_ORDER } from "../types";
import { evaluateAttendanceStatus, openWhatsApp, getCurrentMonthKey, getTodayKey } from "../utils/helpers";
import { enqueuePendingWhatsAppMessagesBatch, enqueuePendingWhatsAppMessage } from "../utils/storage";
import { playBeep, speakArabicGreeting } from "../utils/audio";
import { StudentSearchBox } from "./StudentSearchBox";
import { WhatsAppDispatchModal } from "./WhatsAppDispatchModal";
import {
  ScanLine,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  PlusCircle,
  X,
  Users,
  Search,
  FileText,
  Sparkles,
  ArrowLeft,
  Trash2,
} from "lucide-react";

interface AttendanceScannerProps {
  students?: Student[];
  attendanceToday?: Record<string, string>;
  scanLogOrder?: string[];
  scanLogTimes?: Record<string, string>;
  payments?: Record<string, Record<string, PaymentRecord>>;
  activeSessionSlotId?: string;
  voiceEnabled?: boolean;
  onRecordAttendance?: (
    barcode: string,
    status: "حضور" | "تأخير",
    timeIso: string,
    student: Student
  ) => void;
  onFinishGroup?: (
    grade: GradeName,
    days: GroupDays,
    absentList: { student: Student; message: string }[],
    lateList: { student: Student; message: string }[]
  ) => void;
  onChangeStatus?: (barcode: string, dateKey: string, newStatus: string) => void;
  onNavigateToReport?: () => void;
}

export const AttendanceScanner: React.FC<AttendanceScannerProps> = ({
  students = [],
  attendanceToday = {},
  scanLogOrder = [],
  scanLogTimes = {},
  payments = {},
  activeSessionSlotId = "auto",
  voiceEnabled = true,
  onRecordAttendance,
  onFinishGroup,
  onChangeStatus,
  onNavigateToReport,
}) => {
  // Persist selected grade and days so switching tabs NEVER loses the active session
  const [selectedGrade, setSelectedGrade] = useState<GradeName>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aiman_scanner_grade") as GradeName;
      if (saved && GRADE_ORDER.includes(saved)) return saved;
    }
    return "الصف الرابع الابتدائي";
  });

  const [selectedDays, setSelectedDays] = useState<GroupDays>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aiman_scanner_days") as GroupDays;
      if (saved === "سبت - إثنين - أربعاء" || saved === "أحد - ثلاثاء - خميس") return saved;
    }
    return "سبت - إثنين - أربعاء";
  });

  const [barcodeInput, setBarcodeInput] = useState("");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [selectedManualStudent, setSelectedManualStudent] = useState<Student | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<"current_group" | "all_scanned">("current_group");

  // Success Notification after finishing group
  const [finishedBanner, setFinishedBanner] = useState<{
    grade: GradeName;
    days: GroupDays;
    present: number;
    late: number;
    absent: number;
  } | null>(null);

  // WhatsApp Sequential Dispatch Modal State
  const [dispatchModal, setDispatchModal] = useState<{
    isOpen: boolean;
    grade: GradeName;
    days: GroupDays;
    items: { student: Student; message: string; type: "غائب" | "تأخير" }[];
  }>({
    isOpen: false,
    grade: selectedGrade,
    days: selectedDays,
    items: [],
  });

  const [scanAlert, setScanAlert] = useState<{
    type: "success" | "warning" | "error";
    title: string;
    message: string;
    student?: Student;
    time?: string;
    status?: string;
    isPaid?: boolean;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync selected group to localStorage
  const handleGradeChange = (grade: GradeName) => {
    setSelectedGrade(grade);
    setFinishedBanner(null);
    if (typeof window !== "undefined") {
      localStorage.setItem("aiman_scanner_grade", grade);
    }
  };

  const handleDaysChange = (days: GroupDays) => {
    setSelectedDays(days);
    setFinishedBanner(null);
    if (typeof window !== "undefined") {
      localStorage.setItem("aiman_scanner_days", days);
    }
  };

  // Keep focus on input for continuous scanning
  useEffect(() => {
    if (!isManualModalOpen && !dispatchModal.isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scanAlert, isManualModalOpen, dispatchModal.isOpen]);

  const processAttendance = (student: Student, overrideStatus?: "حضور" | "تأخير") => {
    setFinishedBanner(null);

    // Group verification check
    if (student.groupGrade !== selectedGrade || student.groupDays !== selectedDays) {
      playBeep("error");
      setScanAlert({
        type: "warning",
        title: "⚠️ تنبيه: طالب من مجموعة أخرى!",
        message: `الطالب (${student.name}) مقيد في [${student.groupGrade} - ${student.groupDays}]، بينما المجموعة المحددة بالقاعة الآن هي [${selectedGrade} - ${selectedDays}].`,
        student,
      });
      return;
    }

    const now = new Date();
    const nowTimeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const calculatedStatus = overrideStatus || evaluateAttendanceStatus(now, activeSessionSlotId);

    const monthKey = getCurrentMonthKey();
    const isPaid = !!payments?.[monthKey]?.[student.barcode];

    if (onRecordAttendance) {
      onRecordAttendance(student.barcode, calculatedStatus, now.toISOString(), student);
    }

    playBeep("success");
    speakArabicGreeting(student.name, voiceEnabled);

    setScanAlert({
      type: "success",
      title: `🟢 أهلاً بك يا ${student.name}`,
      message: `المجموعة: ${student.groupGrade} | ${student.groupDays}`,
      student,
      time: nowTimeStr,
      status: calculatedStatus,
      isPaid,
    });
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = barcodeInput.trim();
    setBarcodeInput("");
    if (!barcode) return;

    const student = students.find((s) => String(s.barcode).trim() === barcode);

    if (!student) {
      playBeep("error");
      setScanAlert({
        type: "error",
        title: "❌ باركود غير مسجل",
        message: `الباركود (${barcode}) غير مسجل في منظومة الطلاب! يرجى إضافة الطالب أولاً.`,
      });
      return;
    }

    processAttendance(student);
  };

  const handleRecordManual = (status: "حضور" | "تأخير") => {
    if (!selectedManualStudent) return;
    processAttendance(selectedManualStudent, status);
    setIsManualModalOpen(false);
    setSelectedManualStudent(null);
    setManualSearchQuery("");
  };

  // Handler: Finish and Send Group Attendance
  const handleFinishGroupClick = () => {
    const groupStudents = (students || []).filter(
      (s) => s.groupGrade === selectedGrade && s.groupDays === selectedDays
    );

    if (groupStudents.length === 0) {
      alert("⚠️ لا يوجد طلاب مسجلين في هذه المجموعة حتى الآن!");
      return;
    }

    const absentList: { student: Student; message: string; type: "غائب" }[] = [];
    const lateList: { student: Student; message: string; type: "تأخير" }[] = [];
    let presentCount = 0;

    groupStudents.forEach((student) => {
      const isScanned = (scanLogOrder || []).includes(student.barcode);
      const timeIso = scanLogTimes?.[student.barcode];
      const timeStr = timeIso
        ? new Date(timeIso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
        : "الموعد المحدد";

      const currentStatus = attendanceToday?.[student.barcode];

      if (isScanned && currentStatus === "حضور") {
        presentCount++;
      } else if (isScanned && currentStatus === "تأخير") {
        const msg = `تنبيه من منظومة الأستاذة إيمان الدمشيتي 📐\nنفيدكم بعلم أن الطالب/ة: (${student.name})\nقد وصل متأخراً اليوم عن الموعد المحدد لحصة الرياضيات (${timeStr}).`;
        lateList.push({ student, message: msg, type: "تأخير" });
      } else {
        // Unscanned or marked absent
        const msg = `تنبيه من منظومة الأستاذة إيمان الدمشيتي 📐\nنفيدكم بعلم أن الطالب/ة: (${student.name})\nقد تغيب اليوم عن حضور حصة الرياضيات.`;
        absentList.push({ student, message: msg, type: "غائب" });
      }
    });

    // 1. Permanently record attendance in today's state and history, and clear group from active scanner queue
    if (onFinishGroup) {
      onFinishGroup(selectedGrade, selectedDays, absentList, lateList);
    }

    // 2. Set finished banner info
    setFinishedBanner({
      grade: selectedGrade,
      days: selectedDays,
      present: presentCount,
      late: lateList.length,
      absent: absentList.length,
    });
    setScanAlert(null);

    // 3. Persist messages to persistent WhatsApp Outbox Queue
    const combinedQueue = [...absentList, ...lateList];
    if (combinedQueue.length > 0) {
      // Save all generated absent/late notices to persistent offline WhatsApp queue
      enqueuePendingWhatsAppMessagesBatch(
        combinedQueue.map((item) => ({
          studentBarcode: item.student.barcode,
          studentName: item.student.name,
          grade: item.student.groupGrade,
          phone: item.student.parentPhone,
          messageType: item.type === "غائب" ? "غياب" : "تأخير",
          message: item.message,
        }))
      );

      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (isOnline) {
        setDispatchModal({
          isOpen: true,
          grade: selectedGrade,
          days: selectedDays,
          items: combinedQueue,
        });
      } else {
        alert(
          `⚡ أنت في وضع الأوفلاين (بدون نت):\nتم حفظ سجلات الحضور بنجاح، وتم حفظ عدد (${combinedQueue.length}) رسالة غياب وتأخير في "طابور رسائل الواتساب المعلقة".\nعند عودة الإنترنت يمكنك الضغط على زرار (طابور الواتساب) في الشريط العلوي لإرسال الكل دفعة واحدة!`
        );
      }
    } else {
      alert(`🎉 تم حفظ إثبات الحضور بنجاح! جميع طلاب (${selectedGrade}) حاضرون في الموعد وتم ترحيل السجلات إلى تقرير الحضور.`);
    }
  };

  const currentMonthKey = getCurrentMonthKey();
  
  // Real-time group counts for active group
  const currentGroupStudents = useMemo(() => {
    return (students || []).filter(
      (s) => s.groupGrade === selectedGrade && s.groupDays === selectedDays
    );
  }, [students, selectedGrade, selectedDays]);

  const totalGroupCount = currentGroupStudents.length;

  const currentGroupScanned = useMemo(() => {
    return currentGroupStudents.filter((s) => (scanLogOrder || []).includes(s.barcode));
  }, [currentGroupStudents, scanLogOrder]);

  const currentGroupPresentCount = currentGroupScanned.filter(
    (s) => attendanceToday?.[s.barcode] === "حضور"
  ).length;

  const currentGroupLateCount = currentGroupScanned.filter(
    (s) => attendanceToday?.[s.barcode] === "تأخير"
  ).length;

  const currentGroupUnscannedCount = totalGroupCount - currentGroupScanned.length;

  // Active Scanned list in the scanner table
  const displayedBarcodes = useMemo(() => {
    return (scanLogOrder || []).filter((barcode) => {
      if (viewFilter === "all_scanned") return true;
      const s = students.find((st) => st.barcode === barcode);
      return s && s.groupGrade === selectedGrade && s.groupDays === selectedDays;
    });
  }, [scanLogOrder, viewFilter, students, selectedGrade, selectedDays]);

  const filteredBarcodes = useMemo(() => {
    if (!tableSearch.trim()) return displayedBarcodes;
    const q = tableSearch.trim().toLowerCase();
    return displayedBarcodes.filter((barcode) => {
      const s = students.find((st) => st.barcode === barcode);
      if (!s) return false;
      return (
        s.name.toLowerCase().includes(q) ||
        s.barcode.toLowerCase().includes(q) ||
        s.parentPhone?.includes(q)
      );
    });
  }, [displayedBarcodes, tableSearch, students]);

  return (
    <div className="space-y-6">
      
      {/* Top Group Selector & Action Bar */}
      <div className="glass-panel p-4 md:p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-indigo-500/15 border border-indigo-400/30 px-4 py-2 rounded-2xl shadow-sm">
            <UserCheck className="w-4 h-4 text-indigo-400" />
            <span className="font-tajawal font-bold text-xs md:text-sm text-indigo-200">
              المجموعة النشطة بالقاعة:
            </span>
          </div>

          <select
            value={selectedGrade}
            onChange={(e) => handleGradeChange(e.target.value as GradeName)}
            className="bg-[#0b1226] border border-indigo-500/30 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-2xl outline-none cursor-pointer focus:ring-2 focus:ring-amber-400 shadow-md transition-all font-tajawal"
          >
            {GRADE_ORDER.map((grade) => (
              <option key={grade} value={grade} className="bg-slate-900 text-white font-medium">
                {grade}
              </option>
            ))}
          </select>

          <select
            value={selectedDays}
            onChange={(e) => handleDaysChange(e.target.value as GroupDays)}
            className="bg-[#0b1226] border border-indigo-500/30 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-2xl outline-none cursor-pointer focus:ring-2 focus:ring-amber-400 shadow-md transition-all font-tajawal"
          >
            <option value="سبت - إثنين - أربعاء" className="bg-slate-900 text-white">
              سبت - إثنين - أربعاء
            </option>
            <option value="أحد - ثلاثاء - خميس" className="bg-slate-900 text-white">
              أحد - ثلاثاء - خميس
            </option>
          </select>
        </div>

        {/* Finish Group and Bulk Send Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFinishGroupClick}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white text-xs md:text-sm font-bold shadow-xl shadow-rose-600/25 flex items-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer border border-rose-300/30 font-tajawal"
          >
            <Send className="w-4 h-4" />
            <span>🔒 حفظ وإرسال الغياب والتأخير للكل بضغطة واحدة</span>
          </button>
        </div>
      </div>

      {/* Finished Group Banner Notice */}
      {finishedBanner && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-[#091e17] to-emerald-950/80 border border-emerald-500/40 p-5 rounded-3xl shadow-2xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-inner">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold text-emerald-300 font-fancy">
                ✅ تم حفظ وترحيل سجلات ({finishedBanner.grade} - {finishedBanner.days}) بالكامل!
              </h3>
              <p className="text-xs md:text-sm text-slate-300 mt-0.5 font-tajawal">
                تم تثبيت: <span className="text-emerald-400 font-bold">{finishedBanner.present} حاضر</span> •{" "}
                <span className="text-amber-400 font-bold">{finishedBanner.late} متأخر</span> •{" "}
                <span className="text-rose-400 font-bold">{finishedBanner.absent} غائب</span>. الاسكانر مفرغ وجاهز الآن للمجموعة القادمة.
              </p>
            </div>
          </div>

          {onNavigateToReport && (
            <button
              type="button"
              onClick={onNavigateToReport}
              className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs md:text-sm transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer font-tajawal"
            >
              <FileText className="w-4 h-4" />
              <span>عرض في تقرير الحضور اليومي والسابق</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Live Group Real-time Stats Chips (Redesigned Bento Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-3xl flex items-center justify-between shadow-lg hover:border-amber-400/40 transition-all duration-300 group">
          <div>
            <div className="text-[11px] text-slate-400 font-medium font-tajawal">إجمالي طلاب المجموعة</div>
            <div className="text-2xl md:text-3xl font-black text-amber-300 font-mono mt-1">{totalGroupCount} <span className="text-xs font-normal text-slate-400">طالب</span></div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6 text-amber-400" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-3xl flex items-center justify-between shadow-lg hover:border-emerald-400/40 transition-all duration-300 group">
          <div>
            <div className="text-[11px] text-emerald-400 font-medium font-tajawal">حاضرون بالقاعة الآن</div>
            <div className="text-2xl md:text-3xl font-black text-emerald-400 font-mono mt-1">{currentGroupPresentCount} <span className="text-xs font-normal text-slate-400">طالب</span></div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-3xl flex items-center justify-between shadow-lg hover:border-amber-400/40 transition-all duration-300 group">
          <div>
            <div className="text-[11px] text-amber-400 font-medium font-tajawal">متأخرون</div>
            <div className="text-2xl md:text-3xl font-black text-amber-400 font-mono mt-1">{currentGroupLateCount} <span className="text-xs font-normal text-slate-400">طالب</span></div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-3xl flex items-center justify-between shadow-lg hover:border-rose-400/40 transition-all duration-300 group">
          <div>
            <div className="text-[11px] text-rose-400 font-medium font-tajawal">لم يسجلوا (غياب محتمل)</div>
            <div className="text-2xl md:text-3xl font-black text-rose-400 font-mono mt-1">{Math.max(0, currentGroupUnscannedCount)} <span className="text-xs font-normal text-slate-400">طالب</span></div>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 group-hover:scale-110 transition-transform">
            <XCircle className="w-6 h-6 text-rose-400" />
          </div>
        </div>
      </div>

      {/* Barcode Scanner Input Spotlight */}
      <div className="max-w-2xl mx-auto text-center space-y-3.5">
        <label className="text-base md:text-lg font-bold text-amber-300 flex items-center justify-center gap-2 font-fancy">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span>مرر كارت الطالب أمام الإسكانر لتسجيل الحضور الفوري</span>
        </label>

        <form onSubmit={handleScanSubmit} className="flex gap-2.5">
          <div className="relative flex-1 group">
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="انتظار قراءة الباركود الآلية..."
              autoFocus
              className="w-full bg-[#060a17] border-2 border-indigo-500/40 focus:border-amber-400 text-amber-300 text-center font-mono font-black text-2xl md:text-3xl px-4 py-4 rounded-3xl outline-none focus:ring-4 focus:ring-amber-400/20 shadow-2xl placeholder:text-slate-600 placeholder:text-base transition-all"
            />
            <ScanLine className="w-7 h-7 text-amber-400/70 absolute left-4 top-4 pointer-events-none animate-pulse" />
          </div>

          <button
            type="button"
            onClick={() => {
              setIsManualModalOpen(true);
              setManualSearchQuery("");
              setSelectedManualStudent(null);
            }}
            className="px-5 py-3.5 bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-slate-950 font-bold text-xs md:text-sm rounded-3xl shadow-xl shadow-cyan-500/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer border border-cyan-300/40 transform hover:scale-[1.02] active:scale-95 font-tajawal"
            title="بحث بالاسم أو الكود للتعويض اليدوي"
          >
            <PlusCircle className="w-5 h-5" />
            <span>بحث يدوي ذكي</span>
          </button>
        </form>
      </div>

      {/* Manual Search Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1728] border-2 border-amber-500/40 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
              <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                <span>تسجيل حضور يدوي سريع بالبحث الذكي</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-bold block">
                ابحث بالاسم (مثال: أحمد علي) أو برقم الهاتف أو الباركود:
              </label>
              <StudentSearchBox
                students={students}
                value={manualSearchQuery}
                onChange={(val) => {
                  setManualSearchQuery(val);
                  if (!val) setSelectedManualStudent(null);
                }}
                onSelectStudent={(s) => setSelectedManualStudent(s)}
                placeholder="اكتب اسم الطالب وتجاوز الأسماء الوسطى..."
                autoFocus
              />
            </div>

            {selectedManualStudent && (
              <div className="bg-[#080d17] border border-emerald-500/40 p-4 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-black text-emerald-400">{selectedManualStudent.name}</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {selectedManualStudent.groupGrade} • {selectedManualStudent.groupDays}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-amber-300 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    #{selectedManualStudent.barcode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleRecordManual("حضور")}
                    className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تسجيل (حضور)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecordManual("تأخير")}
                    className="py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/30"
                  >
                    <Clock className="w-4 h-4" />
                    <span>تسجيل (تأخير)</span>
                  </button>
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-400 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
              💡 يمكنك كتابة الاسم الأول والأخير معاً وسيقوم النظام بمطابقة الطالب فوراً حتى لو نسيت الأسماء الوسطى.
            </div>
          </div>
        </div>
      )}

      {/* Live Scan Result Spotlight Card */}
      {scanAlert && (
        <div
          className={`max-w-2xl mx-auto p-4 md:p-6 rounded-3xl border transition-all duration-300 shadow-2xl ${
            scanAlert.type === "success"
              ? "glass-panel border-emerald-500/50 text-white"
              : scanAlert.type === "warning"
              ? "bg-rose-950/80 border-rose-500/60 text-rose-200"
              : "bg-rose-900/80 border-rose-500 text-rose-100"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <h3 className="text-lg md:text-xl font-bold font-fancy text-amber-300">{scanAlert.title}</h3>
              <p className="text-xs md:text-sm text-slate-300 font-tajawal">{scanAlert.message}</p>

              {scanAlert.student && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold border font-tajawal ${
                      scanAlert.isPaid
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}
                  >
                    {scanAlert.isPaid ? "✅ اشتراك الشهر مدفوع" : "⚠️ اشتراك الشهر مستحق"}
                  </span>

                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold border font-tajawal ${
                      scanAlert.status === "تأخير"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    }`}
                  >
                    {scanAlert.status === "تأخير" ? "🟡 تأخير" : "🟢 حضور"}
                  </span>

                  {scanAlert.student.customMonthlyFee !== undefined && (
                    <span className="text-xs px-3 py-1 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 font-tajawal">
                      🏷️ اشتراك مخصص: {scanAlert.student.customMonthlyFee} ج.م
                    </span>
                  )}
                </div>
              )}
            </div>

            {scanAlert.time && (
              <div className="text-left font-mono font-black text-2xl md:text-3xl text-amber-400 bg-slate-950/80 px-5 py-2.5 rounded-2xl border border-indigo-500/30 shadow-inner">
                {scanAlert.time}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance Scanned Log Table */}
      <div className="glass-panel rounded-3xl p-4 md:p-6 shadow-2xl overflow-hidden space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-indigo-500/20">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-base md:text-lg text-amber-300 flex items-center gap-2 font-fancy">
              <span>📋 طابور حضور القاعة بالسكانر</span>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-3 py-0.5 rounded-full font-bold">
                {filteredBarcodes.length} طالب حاضر
              </span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-tajawal">
            {/* Quick Search */}
            <div className="relative">
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="بحث في الحاضرين..."
                className="bg-[#080d1e] border border-indigo-500/30 text-xs text-white px-3 py-2 pr-8 rounded-xl outline-none focus:border-amber-400"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch("")}
                  className="absolute left-2 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* View Filter Switcher */}
            <div className="flex items-center gap-1.5 bg-[#080d1e] p-1 rounded-2xl border border-indigo-500/30 text-xs">
              <button
                type="button"
                onClick={() => setViewFilter("current_group")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  viewFilter === "current_group"
                    ? "bg-amber-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                المجموعة الحالية ({currentGroupScanned.length})
              </button>
              <button
                type="button"
                onClick={() => setViewFilter("all_scanned")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  viewFilter === "all_scanned"
                    ? "bg-amber-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                كل القراءات ({(scanLogOrder || []).length})
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs md:text-sm font-tajawal">
            <thead>
              <tr className="bg-slate-900/90 text-amber-400 font-bold border-b border-indigo-500/30">
                <th className="p-3.5">الترتيب</th>
                <th className="p-3.5">الباركود</th>
                <th className="p-3.5">اسم الطالب</th>
                <th className="p-3.5">المرحلة والمجموعة</th>
                <th className="p-3.5">الاشتراك الشهري</th>
                <th className="p-3.5">حالة الدخول</th>
                <th className="p-3.5">وقت التسجيل</th>
                <th className="p-3.5 text-center">مراسلة سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-950/50">
              {filteredBarcodes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400 space-y-2">
                    <p className="text-sm font-bold text-slate-300 font-fancy">
                      في انتظار قراءة أول كارت بالسكانر لهذه الحصة...
                    </p>
                    <p className="text-xs text-slate-500 font-tajawal">
                      مرر كارت الطالب أمام السكانر، أو استخدم "بحث يدوي ذكي". وبمجرد الانتهاء اضغط على "حفظ وإرسال الغياب للكل" لترحيل البيانات لتقرير الحضور وتفريغ الشاشة للحصة التالية.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBarcodes.map((barcode, idx) => {
                  const student = (students || []).find((s) => String(s.barcode).trim() === barcode);
                  if (!student) return null;
                  const isPaid = !!payments?.[currentMonthKey]?.[barcode];
                  const statusToday = attendanceToday?.[barcode] || "حضور";
                  const orderNumber = filteredBarcodes.length - idx;
                  const scanTimeIso = scanLogTimes?.[barcode];
                  const formattedTime = scanTimeIso
                    ? new Date(scanTimeIso).toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--";

                  return (
                    <tr
                      key={barcode + idx}
                      className="hover:bg-indigo-500/10 transition-colors font-medium"
                    >
                      <td className="p-3.5 font-black text-amber-400 font-mono">#{orderNumber}</td>
                      <td className="p-3.5 font-mono text-slate-300 font-bold">{student.barcode}</td>
                      <td className="p-3.5 font-bold text-white">{student.name}</td>
                      <td className="p-3.5 text-slate-300 text-xs">
                        {student.groupGrade} • {student.groupDays}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`font-bold text-xs px-2.5 py-1 rounded-full ${
                            isPaid
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {isPaid ? "✅ مدفوع" : "❌ غير مدفوع"}
                          {student.customMonthlyFee !== undefined && ` (${student.customMonthlyFee} ج)`}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`font-bold text-xs px-2.5 py-1 rounded-full ${
                            statusToday === "تأخير"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {statusToday === "تأخير" ? "🟡 تأخير" : "🟢 حضور"}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">{formattedTime}</td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            openWhatsApp(
                              student.parentPhone,
                              `السلام عليكم ورحمة الله، نفيدكم بتسجيل حضور الطالب/ة (${student.name}) في حصة الرياضيات.`
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          📲 واتساب
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Report Navigation Link */}
        {onNavigateToReport && (
          <div className="pt-3 border-t border-indigo-500/15 flex items-center justify-between font-tajawal">
            <span className="text-xs text-slate-400">
              💡 لمراجعة سجلات الحضور السابقة والكاملة لكل المجموعات والتواريخ:
            </span>
            <button
              type="button"
              onClick={onNavigateToReport}
              className="text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1.5 hover:underline cursor-pointer"
            >
              <span>الانتقال إلى تقرير الحضور اليومي والسابق</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Sequential WhatsApp Dispatch Queue Modal */}
      {dispatchModal.isOpen && (
        <WhatsAppDispatchModal
          isOpen={dispatchModal.isOpen}
          onClose={() => setDispatchModal({ ...dispatchModal, isOpen: false })}
          grade={dispatchModal.grade}
          days={dispatchModal.days}
          initialItems={dispatchModal.items}
        />
      )}

    </div>
  );
};
