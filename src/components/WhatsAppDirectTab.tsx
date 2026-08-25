import React, { useState, useMemo } from "react";
import { Student } from "../types";
import { openWhatsApp, sortStudentsByGradeAndName, getExamAverage, getAbsenceRate } from "../utils/helpers";
import { StudentSearchBox } from "./StudentSearchBox";
import { matchStudentSearch } from "../utils/search";
import { MessageSquare, Send, AlertTriangle, Search, User, X } from "lucide-react";

interface WhatsAppDirectTabProps {
  students: Student[];
}

export const WhatsAppDirectTab: React.FC<WhatsAppDirectTabProps> = ({ students }) => {
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

    openWhatsApp(selectedStudent.parentPhone, customMessage);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Direct Message Form (2 Columns) */}
      <div className="lg:col-span-2 space-y-5">
        <div className="bg-[#121926]/90 border border-amber-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-amber-500/20">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-400">
                نظام المراسلة الفردية المباشرة
              </h2>
              <p className="text-xs text-slate-400">
                إرسال تنبيهات الواجب، الملاحظات، والتقارير الفردية لولي أمر طالب محدد عبر الواتساب
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs font-bold">
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
              <div className="bg-[#090e17] border border-amber-500/40 p-4 rounded-xl flex items-center justify-between shadow-inner">
                <div>
                  <h4 className="text-sm font-black text-amber-300">{selectedStudent.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedStudent.groupGrade} • {selectedStudent.groupDays} • ولي الأمر: {selectedStudent.parentPhone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setSearchQuery("");
                  }}
                  className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold transition-all"
                >
                  تغيير الطالب ✕
                </button>
              </div>
            )}

            {/* Quick Templates */}
            <div className="space-y-1.5 pt-1">
              <label className="text-slate-400 text-[11px]">قوالب رسائل سريعة بضغطة زر:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSendHomeworkAlert("shortage")}
                  className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all text-right flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>⚠️ تنبيه: تقصير في الواجب</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendHomeworkAlert("no_hw")}
                  className="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all text-right flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>🚨 تنبيه: لم يتم عمل الواجب</span>
                </button>
              </div>
            </div>

            {/* Message Textarea */}
            <div className="space-y-1.5 pt-2">
              <label className="text-slate-300">نص الرسالة المرسلة:</label>
              <textarea
                rows={5}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="اكتب نص الرسالة هنا..."
                className="w-full bg-[#090e17] border border-amber-500/30 focus:border-amber-400 text-slate-100 p-3 rounded-xl outline-none text-xs leading-relaxed"
              />
            </div>

            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!selectedStudent}
              className={`w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                selectedStudent
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-black shadow-emerald-500/20 cursor-pointer"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-60"
              }`}
            >
              <Send className="w-4 h-4" />
              <span>إرسال الرسالة الآن عبر الواتساب 📲</span>
            </button>
          </div>
        </div>
      </div>

      {/* Directory Side List (1 Column) */}
      <div className="bg-[#121926]/90 border border-amber-500/30 p-5 rounded-2xl shadow-xl backdrop-blur-md flex flex-col h-[650px]">
        <h3 className="text-sm font-extrabold text-amber-400 pb-3 border-b border-amber-500/20 mb-3 flex items-center justify-between">
          <span>👥 دليل الطلاب ومؤشرات الأداء</span>
          <span className="text-[11px] text-slate-400 font-normal">{sortedStudents.length} طالب</span>
        </h3>

        {/* Side filter search */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-amber-400/60 absolute right-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={sideSearchQuery}
            onChange={(e) => setSideSearchQuery(e.target.value)}
            placeholder="تصفية الدليل بالاسم أو الكود..."
            className="w-full bg-[#090e17] border border-slate-700 text-slate-200 text-xs pr-8 pl-7 py-2 rounded-xl outline-none focus:border-amber-400"
          />
          {sideSearchQuery && (
            <button
              type="button"
              onClick={() => setSideSearchQuery("")}
              className="absolute left-2 top-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
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
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    selectedStudent?.barcode === s.barcode
                      ? "bg-amber-500/20 border-amber-400 shadow-md"
                      : "bg-[#090e17] border-slate-800 hover:border-amber-500/40"
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-slate-200">{s.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {s.groupGrade} • ({s.barcode})
                    </p>
                  </div>

                  <div className="text-left space-y-0.5 font-bold text-[11px]">
                    <span className={avg >= 80 ? "text-emerald-400" : "text-amber-400"}>
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
  );
};
