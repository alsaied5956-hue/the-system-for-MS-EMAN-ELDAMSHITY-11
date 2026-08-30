import React, { useState, useMemo } from "react";
import { Student } from "../types";
import { openWhatsApp, sortStudentsByGradeAndName, getExamAverage, getAbsenceRate } from "../utils/helpers";
import { enqueuePendingWhatsAppMessage } from "../utils/storage";
import { StudentSearchBox } from "./StudentSearchBox";
import { matchStudentSearch } from "../utils/search";
import { MessageSquare, Send, AlertTriangle, Search, User, X, Clock, Flame } from "lucide-react";

interface WhatsAppDirectTabProps {
  students: Student[];
  onOpenWhatsAppOutbox?: () => void;
  pendingWhatsAppCount?: number;
}

export const WhatsAppDirectTab: React.FC<WhatsAppDirectTabProps> = ({
  students,
  onOpenWhatsAppOutbox,
  pendingWhatsAppCount = 0,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [sideSearchQuery, setSideSearchQuery] = useState("");

  const sortedStudents = useMemo(() => {
    const list = sortStudentsByGradeAndName(students);
    if (!sideSearchQuery.trim()) return list;

    const filtered = list.filter((s) => matchStudentSearch(s, sideSearchQuery).match);
    return filtered.sort((a, b) => {
      const scoreA = matchStudentSearch(a, sideSearchQuery).score;
      const scoreB = matchStudentSearch(b, sideSearchQuery).score;
      return scoreB - scoreA;
    });
  }, [students, sideSearchQuery]);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSearchQuery(student.name);
  };

  const handleSendHomeworkAlert = (type: "shortage" | "no_hw") => {
    if (!selectedStudent) {
      alert("⚠️ يرجى اختيار طالب أولاً من القائمة أو بالبحث!");
      return;
    }

    let text = "";
    if (type === "shortage") {
      text = `تنبيه من منظومة الأستاذة إيمان الدمشيتي 📐\nنفيدكم بعلم أن الطالب/ة: (${selectedStudent.name})\nلديه تقصير في أداء واجب الرياضيات المطلوب منه اليوم.\nنرجو المتابعة والحرص ✨`;
    } else {
      text = `تنبيه هام وعاجل من منظومة الأستاذة إيمان الدمشيتي 📐\nنفيدكم بعلم أن الطالب/ة: (${selectedStudent.name})\nلم يقم بعمل واجب الرياضيات المطلوب منه نهائياً اليوم.\nنرجو التنبيه والمتابعة الفورية ✨`;
    }

    setCustomMessage(text);
  };

  const handleSendMessage = () => {
    if (!selectedStudent) {
      alert("⚠️ يرجى اختيار طالب أولاً!");
      return;
    }
    if (!customMessage.trim()) {
      alert("⚠️ يرجى كتابة نص الرسالة أولاً!");
      return;
    }

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    // Enqueue message into persistent WhatsApp queue
    enqueuePendingWhatsAppMessage({
      studentBarcode: selectedStudent.barcode,
      studentName: selectedStudent.name,
      grade: selectedStudent.groupGrade,
      phone: selectedStudent.parentPhone,
      messageType: "تنبيه",
      message: customMessage.trim(),
    });

    if (isOnline) {
      openWhatsApp(selectedStudent.parentPhone, customMessage.trim());
      alert(`✅ تم إرسال الرسالة لولي أمر (${selectedStudent.name}) عبر الواتساب!`);
    } else {
      alert(
        `⚡ أنت في وضع الأوفلاين (بدون إنترنت):\nتم حفظ الرسالة بنجاح في "طابور رسائل الواتساب المعلقة".\nيمكنك فتح الطابور وإرسال كافة الرسائل بضغطة زر فور عودة الاتصال!`
      );
    }
  };

  return (
    <div className="space-y-6 font-tajawal">
      {/* Top Banner for Offline Outbox Access */}
      {onOpenWhatsAppOutbox && (
        <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 p-5 bg-gradient-to-r from-[#0d1627]/90 via-[#101b30]/90 to-[#0d1627]/90 flex flex-wrap items-center justify-between gap-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-md">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-fancy flex items-center gap-2">
                <span>طابور رسائل الواتساب المعلقة (Offline Outbox)</span>
                {pendingWhatsAppCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-bold font-mono animate-pulse">
                    {pendingWhatsAppCount} رسائل بانتظار الإرسال
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تخزين رسائل الغياب والتأخير والدرجات والمصاريف أوفلاين وإرسالها دفعة واحدة فور عودة الشبكة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenWhatsAppOutbox}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 hover:from-amber-300 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Flame className="w-4 h-4 text-slate-950" />
            <span>عرض طابور الرسائل المعلقة ({pendingWhatsAppCount})</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Direct Message Form (2 Columns) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-2xl space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-indigo-500/20">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center shadow-md">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-fancy text-amber-300">
                  نظام المراسلة الفردية المباشرة
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  إرسال تنبيهات الواجب، الملاحظات، والتقارير الفردية لولي أمر طالب محدد عبر الواتساب
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-bold font-tajawal">
              {/* Student Search with High-Performance Fuzzy Box */}
              <div className="space-y-1.5">
                <label className="text-slate-300">ابحث باسم الطالب (تسامح مع الإملاء والأجزاء) أو الباركود / الكود:</label>
                <StudentSearchBox
                  students={students}
                  value={searchQuery}
                  onChange={(val) => {
                    setSearchQuery(val);
                    if (!val) setSelectedStudent(null);
                  }}
                  onSelectStudent={(s) => {
                    setSelectedStudent(s);
                    setSearchQuery(s.name);
                  }}
                  placeholder="ابحث بالاسم (مثال: أحمد علي) أو برقم الهاتف أو الباركود..."
                />
              </div>

              {/* Selected Student Card */}
              {selectedStudent && (
                <div className="glass-card border-amber-500/40 p-4 rounded-2xl flex items-center justify-between shadow-inner animate-in fade-in">
                  <div>
                    <h4 className="text-base font-bold text-amber-300 font-fancy">{selectedStudent.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedStudent.groupGrade} • {selectedStudent.groupDays} • ولي الأمر: <span className="font-mono text-slate-300">{selectedStudent.parentPhone}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudent(null);
                      setSearchQuery("");
                    }}
                    className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    تغيير الطالب ✕
                  </button>
                </div>
              )}

              {/* Quick Templates */}
              <div className="space-y-2 pt-1">
                <label className="text-slate-400 text-xs">قوالب رسائل سريعة بضغطة زر:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSendHomeworkAlert("shortage")}
                    className="py-2.5 px-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all text-right flex items-center gap-2 cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>⚠️ تنبيه: تقصير في الواجب</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendHomeworkAlert("no_hw")}
                    className="py-2.5 px-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all text-right flex items-center gap-2 cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>🚨 تنبيه: لم يتم عمل الواجب</span>
                  </button>
                </div>
              </div>

              {/* Message Textarea */}
              <div className="space-y-1.5 pt-1">
                <label className="text-slate-300">نص الرسالة المرسلة:</label>
                <textarea
                  rows={5}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="اكتب نص الرسالة هنا..."
                  className="w-full bg-[#080d1e] border border-indigo-500/30 focus:border-amber-400 text-slate-100 p-4 rounded-2xl outline-none text-xs leading-relaxed transition-all font-medium"
                />
              </div>

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!selectedStudent}
                className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl ${
                  selectedStudent
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 shadow-emerald-500/20 cursor-pointer active:scale-[0.99]"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                }`}
              >
                <Send className="w-4 h-4" />
                <span>إرسال الرسالة الآن عبر الواتساب 📲</span>
              </button>
            </div>
          </div>
        </div>

        {/* Directory Side List (1 Column) */}
        <div className="glass-panel p-5 rounded-3xl shadow-2xl flex flex-col h-[650px]">
          <h3 className="text-sm font-bold font-fancy text-amber-300 pb-3 border-b border-indigo-500/20 mb-3 flex items-center justify-between">
            <span>👥 دليل الطلاب ومؤشرات الأداء</span>
            <span className="text-[11px] text-slate-400 font-mono font-normal">{sortedStudents.length} طالب</span>
          </h3>

          {/* Side filter search */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-amber-400/60 absolute right-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={sideSearchQuery}
              onChange={(e) => setSideSearchQuery(e.target.value)}
              placeholder="تصفية الدليل بالاسم أو الكود..."
              className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-200 text-xs pr-10 pl-8 py-2.5 rounded-2xl outline-none focus:border-amber-400 transition-all font-medium"
            />
            {sideSearchQuery && (
              <button
                type="button"
                onClick={() => setSideSearchQuery("")}
                className="absolute left-3 top-3 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {sortedStudents.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-6">لا يوجد طلاب مطابقين للتصفية.</p>
            ) : (
              sortedStudents.map((s) => {
                const avg = getExamAverage(s);
                const abs = getAbsenceRate(s);

                return (
                  <div
                    key={s.barcode}
                    onClick={() => handleSelectStudent(s)}
                    className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      selectedStudent?.barcode === s.barcode
                        ? "bg-amber-500/15 border-amber-400/80 shadow-lg"
                        : "glass-card hover:border-amber-500/30"
                    }`}
                  >
                    <div>
                      <h4 className="font-bold font-fancy text-slate-200">{s.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {s.groupGrade} • <span className="font-mono text-amber-300/80">#{s.barcode}</span>
                      </p>
                    </div>

                    <div className="text-left space-y-0.5 font-bold text-[11px] font-mono">
                      <span className={avg >= 80 ? "text-emerald-400" : "text-amber-300"}>
                        امتحان: {avg}%
                      </span>
                      <br />
                      <span className={abs > 20 ? "text-rose-400" : "text-slate-400"}>
                        غياب: {abs}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
