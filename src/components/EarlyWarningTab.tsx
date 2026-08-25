import React, { useState, useMemo } from "react";
import { Student, PaymentRecord, GradeName, GRADE_ORDER } from "../types";
import { getAttendanceRate, getAbsenceRate, getExamAverage, openWhatsApp, getCurrentMonthKey } from "../utils/helpers";
import { matchStudentSearch } from "../utils/search";
import { AlertTriangle, AlertOctagon, ShieldAlert, Send, Filter, CheckCircle, Search, X } from "lucide-react";

interface EarlyWarningTabProps {
  students?: Student[];
  payments?: Record<string, Record<string, PaymentRecord>>;
}

export const EarlyWarningTab: React.FC<EarlyWarningTabProps> = ({
  students = [],
  payments = {},
}) => {
  const [filterType, setFilterType] = useState<"ALL" | "ABSENCE" | "GRADES" | "PAYMENT">("ALL");
  const [filterGrade, setFilterGrade] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const currentMonthKey = getCurrentMonthKey();

  // Evaluate students at risk
  const warningList = useMemo(() => {
    return students
      .map((student) => {
        const absRate = getAbsenceRate(student);
        const examAvg = getExamAverage(student);
        const isUnpaid = !payments?.[currentMonthKey]?.[student.barcode];

        const reasons: string[] = [];
        let severity: "high" | "medium" | "low" = "low";

        // Absence Risk
        if (absRate >= 30 || student.totalAbsentDays >= 3) {
          reasons.push(`نسبة غياب مرتفعة جداً (${absRate}%) - غاب ${student.totalAbsentDays} حصص`);
          severity = "high";
        } else if (absRate >= 20 || student.totalAbsentDays >= 2) {
          reasons.push(`غياب متكرر (${absRate}%)`);
          severity = "medium";
        }

        // Exam Risk
        if (student.totalExamScores && student.totalExamScores.length > 0) {
          if (examAvg < 50) {
            reasons.push(`تراجع حاد في درجات الرياضيات (${examAvg}%)`);
            severity = "high";
          } else if (examAvg < 65) {
            reasons.push(`مستوى أكاديمي ضعيف (${examAvg}%)`);
            if (severity === "low") {
              severity = "medium";
            }
          }
        }

        // Unpaid
        if (isUnpaid) {
          reasons.push(`اشتراك شهر ${currentMonthKey} غير مدفوع حتى الآن`);
        }

        return {
          student,
          reasons,
          absRate,
          examAvg,
          isUnpaid,
          severity,
          hasRisk: reasons.length > 0,
        };
      })
      .filter((item) => {
        if (!item.hasRisk) return false;
        if (filterGrade !== "ALL" && item.student.groupGrade !== filterGrade) return false;
        if (filterType === "ABSENCE" && item.absRate < 20) return false;
        if (filterType === "GRADES" && item.examAvg >= 65) return false;
        if (filterType === "PAYMENT" && !item.isUnpaid) return false;
        if (searchQuery.trim()) {
          const { match } = matchStudentSearch(item.student, searchQuery);
          return match;
        }
        return true;
      });
  }, [students, payments, currentMonthKey, filterGrade, filterType, searchQuery]);

  const handleSendWarning = (student: Student, reasons: string[]) => {
    const reasonsText = reasons.map((r) => `• ${r}`).join("\n");
    const msg = `🚨 إنذار متابعة عاجل من منظومة الأستاذة إيمان الدمشيتي 📐\n\nنلفت عناية ولي أمر الطالب/ة: (${student.name})\nالمقيد في: ${student.groupGrade}\n\nنود إحاطتكم علماً بالملاحظات التالية:\n${reasonsText}\n\nنرجو التواصل الفوري والاهتمام لمصلحة الطالب ومستقبله التعليمي ✨`;
    openWhatsApp(student.parentPhone, msg);
  };

  const highCount = warningList.filter((w) => w.severity === "high").length;
  const mediumCount = warningList.filter((w) => w.severity === "medium").length;

  return (
    <div className="space-y-6">
      {/* Alert Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#121926]/90 border border-rose-500/40 p-4 rounded-2xl flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-rose-300 font-bold">إنذارات عالية الخطورة 🔴</p>
            <p className="text-2xl font-black text-rose-400">{highCount} طالب</p>
          </div>
        </div>

        <div className="bg-[#121926]/90 border border-amber-500/40 p-4 rounded-2xl flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-amber-300 font-bold">إنذارات متوسطة 🟡</p>
            <p className="text-2xl font-black text-amber-400">{mediumCount} طالب</p>
          </div>
        </div>

        <div className="bg-[#121926]/90 border border-sky-500/40 p-4 rounded-2xl flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-sky-500/20 text-sky-400 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-sky-300 font-bold">إجمالي الحالات المتابعة</p>
            <p className="text-2xl font-black text-sky-400">{warningList.length} طالب</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#121926]/90 border border-amber-500/20 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "ALL" | "ABSENCE" | "GRADES" | "PAYMENT")}
            className="bg-[#090e17] border border-amber-500/30 text-slate-100 text-xs font-bold px-3 py-2 rounded-xl outline-none"
          >
            <option value="ALL">جميع أنواع الإنذارات</option>
            <option value="ABSENCE">إنذارات الغياب المتكرر فقط 🔴</option>
            <option value="GRADES">إنذارات تراجع الدرجات فقط 📉</option>
            <option value="PAYMENT">المتأخرات المالية فقط 💳</option>
          </select>

          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="bg-[#090e17] border border-amber-500/30 text-slate-100 text-xs font-bold px-3 py-2 rounded-xl outline-none"
          >
            <option value="ALL">كل الصفوف الدراسية</option>
            {GRADE_ORDER.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-amber-400/60 absolute right-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الباركود..."
              className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 text-xs pr-8 pl-7 py-2 rounded-xl outline-none focus:border-amber-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-2 top-2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400">
          النظام يفحص آلياً نسب الغياب والدرجات وحالة الدفع للتنبيه الاستباقي
        </p>
      </div>

      {/* Warning List Cards */}
      <div className="space-y-3">
        {warningList.length === 0 ? (
          <div className="bg-[#121926]/80 border border-emerald-500/30 p-8 rounded-2xl text-center space-y-2">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-base font-extrabold text-emerald-400">
              {searchQuery ? `لا توجد إنذارات مطابقة لبحث "${searchQuery}"` : "رائع! لا يوجد طلاب في دائرة الخطر أو الإنذار حالياً"}
            </h3>
            <p className="text-xs text-slate-400">
              جميع الطلاب يظهرون التزاماً ممتازاً بالحضور ومستوى درجات مستقر.
            </p>
          </div>
        ) : (
          warningList.map(({ student, reasons, severity, absRate, examAvg }) => (
            <div
              key={student.barcode}
              className={`p-4 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-4 shadow-lg ${
                severity === "high"
                  ? "bg-[#181119] border-rose-500/50 border-r-8 border-r-rose-500"
                  : "bg-[#171511] border-amber-500/40 border-r-8 border-r-amber-500"
              }`}
            >
              <div className="space-y-1.5 flex-1 min-w-[280px]">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-white">{student.name}</h4>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    #{student.barcode}
                  </span>
                  <span className="text-xs font-bold text-amber-300/90">
                    {student.groupGrade} ({student.groupDays})
                  </span>
                </div>

                <div className="space-y-1 pt-1">
                  {reasons.map((reason, i) => (
                    <div key={i} className="text-xs text-rose-300 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                  <span>
                    نسبة الغياب: <strong className="text-rose-400">{absRate}%</strong>
                  </span>
                  <span>
                    متوسط الدرجات: <strong className="text-amber-400">{examAvg}%</strong>
                  </span>
                  <span>
                    ولي الأمر: <strong className="text-slate-200 font-mono">{student.parentPhone}</strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSendWarning(student, reasons)}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/30 flex items-center gap-2 transition-all transform hover:scale-[1.02] shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>إرسال إنذار فوري لولي الأمر 📲</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
