import React, { useState, useRef, useEffect } from "react";
import { Student, GradeName, GroupDays, PaymentRecord, GRADE_ORDER } from "../types";
import { evaluateAttendanceStatus, openWhatsApp, getCurrentMonthKey } from "../utils/helpers";
import { playBeep, speakArabicGreeting } from "../utils/audio";
import { StudentSearchBox } from "./StudentSearchBox";
import { ScanLine, UserCheck, Clock, CheckCircle2, XCircle, Send, AlertOctagon, PlusCircle, User, X } from "lucide-react";

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
}) => {
  const [selectedGrade, setSelectedGrade] = useState<GradeName>("الصف الرابع الابتدائي");
  const [selectedDays, setSelectedDays] = useState<GroupDays>("سبت - إثنين - أربعاء");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [selectedManualStudent, setSelectedManualStudent] = useState<Student | null>(null);

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

  // Keep focus on input for continuous scanning
  useEffect(() => {
    if (!isManualModalOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scanAlert, isManualModalOpen]);

  const processAttendance = (student: Student, overrideStatus?: "حضور" | "تأخير") => {
    // Group verification check
    if (student.groupGrade !== selectedGrade || student.groupDays !== selectedDays) {
      playBeep("error");
      setScanAlert({
        type: "warning",
        title: "⚠️ تنبيه: طالب من مجموعة أخرى!",
        message: `الطالب (${student.name}) مقيد في [${student.groupGrade} - ${student.groupDays}]، والمجموعة المحددة بالقاعة الآن هي [${selectedGrade} - ${selectedDays}].`,
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

  const handleFinishGroupClick = () => {
    const groupStudents = (students || []).filter(
      (s) => s.groupGrade === selectedGrade && s.groupDays === selectedDays
    );

    if (groupStudents.length === 0) {
      alert("⚠️ لا يوجد طلاب مسجلين في هذه المجموعة حتى الآن!");
      return;
    }

    if (
      !confirm(
        `هل أنت متأكد من حفظ وإرسال تقرير الغياب والتأخير لـ (${selectedGrade} - ${selectedDays})؟ سيتم تجهيز رسائل الواتساب لأولياء أمور الغائبين والمتأخرين وبدء عد جديد.`
      )
    ) {
      return;
    }

    const absentList: { student: Student; message: string }[] = [];
    const lateList: { student: Student; message: string }[] = [];

    groupStudents.forEach((student) => {
      const isScanned = (scanLogOrder || []).includes(student.barcode);
      const timeIso = scanLogTimes?.[student.barcode];
      const timeStr = timeIso
        ? new Date(timeIso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
        : "الموعد المحدد";

      if (isScanned) {
        const status = attendanceToday?.[student.barcode];
        if (status === "تأخير") {
          const msg = `تنبيه من منظومة الأستاذة إيمان الدمشيتي 📐\nنفيدكم بعلم أن الطالب/ة: (${student.name})\nقد وصل متأخراً اليوم عن الموعد المحدد لحصة الرياضيات (${timeStr}).`;
          lateList.push({ student, message: msg });
        }
      } else {
        const msg = `تنبيه من منظومة الأستاذة إيمان الدمشيتي 📐\nنفيدكم بعلم أن الطالب/ة: (${student.name})\nقد تغيب اليوم عن حضور حصة الرياضيات.`;
        absentList.push({ student, message: msg });
      }
    });

    if (onFinishGroup) {
      onFinishGroup(selectedGrade, selectedDays, absentList, lateList);
    }
  };

  const currentMonthKey = getCurrentMonthKey();
  const totalScanned = (scanLogOrder || []).length;

  return (
    <div className="space-y-6">
      {/* Top Group Header Bar */}
      <div className="bg-[#121926]/90 border border-amber-500/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-extrabold text-sm text-amber-400 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4" />
            المجموعة الحالية بالقاعة:
          </span>

          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value as GradeName)}
            className="bg-[#090e17] border border-amber-500/40 text-slate-100 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-amber-400"
          >
            {GRADE_ORDER.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>

          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(e.target.value as GroupDays)}
            className="bg-[#090e17] border border-amber-500/40 text-slate-100 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-amber-400"
          >
            <option value="سبت - إثنين - أربعاء">سبت - إثنين - أربعاء</option>
            <option value="أحد - ثلاثاء - خميس">أحد - ثلاثاء - خميس</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleFinishGroupClick}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-black shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95"
        >
          <Send className="w-4 h-4" />
          <span>🔒 حفظ وإرسال الغياب والتأخير للكل بضغطة واحدة</span>
        </button>
      </div>

      {/* Barcode Scanner Input */}
      <div className="max-w-xl mx-auto text-center space-y-3">
        <label className="text-base font-extrabold text-amber-300 block">
          ضع المؤشر هنا ومرر كارت الطالب أمام الإسكانر 📡
        </label>

        <form onSubmit={handleScanSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="انتظار قراءة الباركود الآلية..."
              autoFocus
              className="w-full bg-[#090e17] border-2 border-amber-400 text-amber-300 text-center font-mono font-bold text-2xl px-4 py-3.5 rounded-2xl outline-none focus:ring-4 focus:ring-amber-400/30 shadow-inner placeholder:text-slate-600 placeholder:text-base"
            />
            <ScanLine className="w-6 h-6 text-amber-400/50 absolute left-4 top-4 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => {
              setIsManualModalOpen(true);
              setManualSearchQuery("");
              setSelectedManualStudent(null);
            }}
            className="px-4 py-3 bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-black font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="بحث بالاسم أو الكود للتعويض اليدوي"
          >
            <PlusCircle className="w-4 h-4" />
            <span>بحث يدوي ذكي</span>
          </button>
        </form>
      </div>

      {/* Manual Search Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121926] border-2 border-amber-500/40 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
              <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                <span>تسجيل حضور يدوي سريع بالبحث الذكي</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
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
              <div className="bg-[#090e17] border border-emerald-500/40 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-emerald-400">{selectedManualStudent.name}</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {selectedManualStudent.groupGrade} • {selectedManualStudent.groupDays}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-amber-300 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                    #{selectedManualStudent.barcode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleRecordManual("حضور")}
                    className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تسجيل (حضور)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecordManual("تأخير")}
                    className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <Clock className="w-4 h-4" />
                    <span>تسجيل (تأخير)</span>
                  </button>
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              💡 يمكنك كتابة الاسم الأول والأخير معاً وسيقوم النظام بمطابقة الطالب فوراً حتى لو نسيت الأسماء الوسطى أو أخطأت في كتابة الهمزات.
            </div>
          </div>
        </div>
      )}

      {/* Live Scan Result Card */}
      {scanAlert && (
        <div
          className={`max-w-2xl mx-auto p-4 rounded-2xl border transition-all duration-300 shadow-2xl ${
            scanAlert.type === "success"
              ? "bg-[#0f172a]/95 border-amber-400 border-r-8 border-r-amber-400"
              : scanAlert.type === "warning"
              ? "bg-rose-950/60 border-rose-500 border-r-8 border-r-rose-500 text-rose-200"
              : "bg-rose-900/80 border-rose-500 text-rose-100"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-amber-300">{scanAlert.title}</h3>
              <p className="text-xs text-slate-300 mt-0.5">{scanAlert.message}</p>

              {scanAlert.student && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      scanAlert.isPaid
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}
                  >
                    {scanAlert.isPaid ? "✅ اشتراك الشهر مدفوع" : "⚠️ اشتراك الشهر مستحق"}
                  </span>

                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      scanAlert.status === "تأخير"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    }`}
                  >
                    {scanAlert.status === "تأخير" ? "🟡 تأخير" : "🟢 حضور"}
                  </span>

                  {scanAlert.student.customMonthlyFee !== undefined && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      🏷️ اشتراك مخصص: {scanAlert.student.customMonthlyFee} ج.م
                    </span>
                  )}
                </div>
              )}
            </div>

            {scanAlert.time && (
              <div className="text-left font-mono font-black text-2xl text-amber-400">
                {scanAlert.time}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance Scanned Log Table */}
      <div className="bg-[#121926]/80 border border-amber-500/20 rounded-2xl p-5 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 mb-4">
          <h3 className="font-extrabold text-base text-amber-400 flex items-center gap-2">
            <span>📋 قائمة حضور القاعة الحالية</span>
            <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full">
              {totalScanned} طالب
            </span>
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            (الترتيب 1 يبدأ من الأسفل ويتصاعد للأعلى)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-amber-400 font-extrabold border-b border-amber-500/30">
                <th className="p-3">الترتيب</th>
                <th className="p-3">الباركود</th>
                <th className="p-3">اسم الطالب</th>
                <th className="p-3">المجموعة</th>
                <th className="p-3">الاشتراك الشهري</th>
                <th className="p-3">حالة اليوم</th>
                <th className="p-3">وقت الدخول</th>
                <th className="p-3">مراسلة سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {!scanLogOrder || scanLogOrder.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                    في انتظار أول قراءة حضور بالسكانر...
                  </td>
                </tr>
              ) : (
                scanLogOrder.map((barcode, idx) => {
                  const student = (students || []).find((s) => String(s.barcode).trim() === barcode);
                  if (!student) return null;
                  const isPaid = !!payments?.[currentMonthKey]?.[barcode];
                  const statusToday = attendanceToday?.[barcode] || "حضور";
                  const orderNumber = totalScanned - idx;
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
                      className="hover:bg-amber-500/5 transition-colors font-medium"
                    >
                      <td className="p-3 font-black text-amber-400">#{orderNumber}</td>
                      <td className="p-3 font-mono">{student.barcode}</td>
                      <td className="p-3 font-bold text-slate-100">{student.name}</td>
                      <td className="p-3 text-slate-400">{student.groupGrade}</td>
                      <td className="p-3">
                        <span
                          className={`font-bold ${
                            isPaid ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isPaid ? "✅ مدفوع" : "❌ غير مدفوع"}
                          {student.customMonthlyFee !== undefined && ` (${student.customMonthlyFee} ج)`}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-bold ${
                            statusToday === "تأخير" ? "text-amber-400" : "text-emerald-400"
                          }`}
                        >
                          {statusToday === "تأخير" ? "🟡 تأخير" : "🟢 حضور"}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{formattedTime}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() =>
                            openWhatsApp(
                              student.parentPhone,
                              `السلام عليكم ورحمة الله، نفيدكم بتسجيل حضور الطالب/ة (${student.name}) في حصة الرياضيات.`
                            )
                          }
                          className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold"
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
      </div>
    </div>
  );
};
