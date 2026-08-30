import React, { useState } from "react";
import { Student } from "../types";
import { openWhatsApp, SCHOOL_WHATSAPP_PHONE, sortStudentsByGradeAndName } from "../utils/helpers";
import { enqueuePendingWhatsAppMessage } from "../utils/storage";
import { playBeep } from "../utils/audio";
import { StudentSearchBox } from "./StudentSearchBox";
import { FileCheck2, Send, Sparkles, UserCheck, MessageSquare, Clock } from "lucide-react";

interface ExamGradesTabProps {
  students: Student[];
  onRecordGrade: (barcode: string, examTitle: string, score: number, maxScore: number) => void;
}

export const ExamGradesTab: React.FC<ExamGradesTabProps> = ({
  students,
  onRecordGrade,
}) => {
  const [examTitle, setExamTitle] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [maxScore, setMaxScore] = useState<number>(50);
  const [studentScore, setStudentScore] = useState<number | "">("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSearchInput(student.name);
    playBeep("success");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert("⚠️ يرجى اختيار أو مسح باركود طالب مسجل أولاً!");
      return;
    }

    const scoreNum = Number(studentScore);
    const maxNum = Number(maxScore);

    if (isNaN(scoreNum) || isNaN(maxNum) || maxNum <= 0) {
      alert("⚠️ يرجى إدخال درجات صحيحة ومقبولة!");
      return;
    }

    if (scoreNum > maxNum) {
      alert(`⚠️ لا يمكن أن تكون درجة الطالب (${scoreNum}) أكبر من الدرجة العظمى (${maxNum})!`);
      return;
    }

    onRecordGrade(selectedStudent.barcode, examTitle.trim() || "امتحان الرياضيات", scoreNum, maxNum);
    playBeep("success");

    const percentage = Math.round((scoreNum / maxNum) * 100);
    let evaluation = "ممتاز جداً 🌟 واصل التألق والتميز!";
    if (percentage < 60) {
      evaluation = "⚠️ تحذير عاجل: مستوى الطالب يحتاج متابعة ومذاكرة مضاعفة.";
    } else if (percentage < 80) {
      evaluation = "جيد 👍 ونتطلع للمزيد من الاجتهاد والتركيز.";
    }

    const msg = `نتيجة اختبار الرياضيات 📐\nالامتحان: (${examTitle})\nاسم الطالب: ${selectedStudent.name}\nالصف: ${selectedStudent.groupGrade}\nالدرجة: ${scoreNum} من ${maxNum} (${percentage}%)\nالتقييم: ${evaluation}\nمع تحيات ميس إيمان الدمشيتي ✨`;

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    // Enqueue message into persistent WhatsApp queue
    enqueuePendingWhatsAppMessage({
      studentBarcode: selectedStudent.barcode,
      studentName: selectedStudent.name,
      grade: selectedStudent.groupGrade,
      phone: selectedStudent.parentPhone,
      messageType: "درجات",
      message: msg,
    });

    if (isOnline) {
      openWhatsApp(selectedStudent.parentPhone, msg);
      alert(`✅ تم رصد درجة (${selectedStudent.name}) وإرسال النتيجة لولي الأمر عبر الواتساب بنجاح!`);
    } else {
      alert(
        `⚡ أنت في وضع الأوفلاين (بدون إنترنت):\nتم رصد درجة (${selectedStudent.name}) وحفظ رسالة النتيجة في "طابور رسائل الواتساب المعلقة".\nفور عودة الإنترنت يمكنك إرسال كافة النتائج دفعة واحدة بضغطة زر من الشريط العلوي!`
      );
    }

    setSearchInput("");
    setSelectedStudent(null);
    setStudentScore("");
  };

  const handleSendAllGradesToTeacher = () => {
    const sorted = sortStudentsByGradeAndName(students);
    let msg = `📋 كشف درجات آخر اختبار لطلاب ميس إيمان الدمشيتي:\n\n`;
    let count = 0;
    sorted.forEach((s) => {
      if (s.lastExamScore) {
        count++;
        msg += `• ${s.name} (${s.groupGrade}): ${s.lastExamScore}\n`;
      }
    });

    if (count === 0) {
      alert("⚠️ لا يوجد درجات مسجلة للطلاب بعد!");
      return;
    }

    openWhatsApp(SCHOOL_WHATSAPP_PHONE, msg);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3.5 pb-4 border-b border-indigo-500/20">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-md">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-fancy text-amber-300">
                رصد وإضافة درجات الاختبارات الفورية
              </h2>
              <p className="text-xs text-slate-400 font-tajawal mt-0.5">
                بحث ذكي بالاسم أو الباركود وحساب النسب المئوية آلياً مع إشعار ولي الأمر
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendAllGradesToTeacher}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500/20 to-cyan-500/10 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer font-tajawal"
          >
            <span>📲 إرسال الكشف لميس إيمان</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold font-tajawal">
          <div className="space-y-1.5">
            <label className="text-slate-300">عنوان أو موضوع الامتحان *</label>
            <input
              type="text"
              required
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="مثال: اختبار الهندسة - الوحدة الأولى"
              className="w-full bg-[#080d1e] border border-indigo-500/30 focus:border-amber-400 text-slate-100 px-4 py-3 rounded-2xl outline-none text-sm font-medium transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 flex items-center justify-between">
              <span>ابحث باسم الطالب أو باركود الكارت:</span>
              <span className="text-[11px] text-amber-400 font-normal">
                يدعم البحث السريع (الاسم الأول والأخير وتخطي الأسماء الوسطى)
              </span>
            </label>
            <StudentSearchBox
              students={students}
              value={searchInput}
              onChange={(val) => {
                setSearchInput(val);
                if (!val) setSelectedStudent(null);
              }}
              onSelectStudent={handleSelectStudent}
              placeholder="اكتب اسم الطالب (مثال: أحمد علي) أو اضرب الباركود..."
              autoFocus
            />
          </div>

          {selectedStudent && (
            <div className="glass-card border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between animate-in fade-in">
              <div>
                <h4 className="text-sm font-bold text-emerald-300 font-fancy">{selectedStudent.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedStudent.groupGrade} • {selectedStudent.groupDays} • باركود #{selectedStudent.barcode}
                </p>
              </div>
              <div className="text-left font-mono text-xs text-amber-300">
                ⭐ النقاط: {selectedStudent.points || 0}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300">الدرجة العظمى (الامتحان من كام) *</label>
              <input
                type="number"
                min={1}
                required
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
                placeholder="مثال: 50 أو 100"
                className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-100 px-4 py-3 rounded-2xl font-mono text-sm outline-none font-bold focus:border-amber-400 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300">درجة الطالب المحققة *</label>
              <input
                type="number"
                step="0.5"
                min={0}
                required
                value={studentScore}
                onChange={(e) => setStudentScore(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="مثال: 48.5"
                className="w-full bg-[#080d1e] border border-amber-400 text-amber-300 font-black px-4 py-3 rounded-2xl text-lg outline-none font-mono focus:ring-2 focus:ring-amber-400/30 transition-all"
              />
            </div>
          </div>

          {studentScore !== "" && maxScore > 0 && (
            <div className="p-3.5 bg-slate-950/60 rounded-2xl text-center border border-indigo-500/20">
              <span className="text-slate-400 text-xs">النسبة المحققة: </span>
              <span className="text-lg font-black text-amber-300 font-mono">
                {Math.round((Number(studentScore) / maxScore) * 100)}%
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedStudent}
            className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl ${
              selectedStudent
                ? "bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 hover:from-amber-300 hover:to-yellow-100 text-slate-950 shadow-amber-500/25 cursor-pointer active:scale-[0.99]"
                : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
            }`}
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>حفظ النتيجة وإرسالها المباشر لولي الأمر 📲</span>
          </button>
        </form>
      </div>
    </div>
  );
};
