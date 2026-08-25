import React, { useState, useMemo } from "react";
import { Student, PaymentRecord, GradeName, GRADE_ORDER } from "../types";
import { getCurrentMonthKey, getTodayKey, sortStudentsByGradeAndName, DEFAULT_GRADE_PRICES, openWhatsApp } from "../utils/helpers";
import { matchStudentSearch } from "../utils/search";
import * as XLSX from "xlsx";
import { Coins, FileSpreadsheet, CheckCircle2, XCircle, Search, Calendar, Tag, X } from "lucide-react";

interface FinancialsTabProps {
  students: Student[];
  payments: Record<string, Record<string, PaymentRecord>>;
  groupPrices: Record<GradeName, number>;
}

export const FinancialsTab: React.FC<FinancialsTabProps> = ({
  students,
  payments,
  groupPrices,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [filterGrade, setFilterGrade] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const todayKey = getTodayKey();
  const monthPayments = payments[selectedMonth] || {};

  const filteredStudents = useMemo(() => {
    let result = students.filter((s) => {
      if (filterGrade !== "ALL" && s.groupGrade !== filterGrade) return false;
      const isPaid = !!monthPayments[s.barcode];
      if (filterStatus === "PAID" && !isPaid) return false;
      if (filterStatus === "UNPAID" && isPaid) return false;
      if (searchQuery.trim()) {
        const { match } = matchStudentSearch(s, searchQuery);
        return match;
      }
      return true;
    });

    if (searchQuery.trim()) {
      result = [...result].sort((a, b) => {
        const scoreA = matchStudentSearch(a, searchQuery).score;
        const scoreB = matchStudentSearch(b, searchQuery).score;
        return scoreB - scoreA;
      });
      return result;
    }

    return sortStudentsByGradeAndName(result);
  }, [students, selectedMonth, filterGrade, filterStatus, searchQuery, monthPayments]);

  const { paidCount, unpaidCount, todayAmount, monthTotalAmount } = useMemo(() => {
    let paid = 0;
    let unpaid = 0;
    let todayTot = 0;
    let monthTot = 0;

    filteredStudents.forEach((s) => {
      const pay = monthPayments[s.barcode];
      if (pay) {
        paid++;
        monthTot += pay.amount;
        if (pay.date === todayKey) {
          todayTot += pay.amount;
        }
      } else {
        unpaid++;
      }
    });

    return {
      paidCount: paid,
      unpaidCount: unpaid,
      todayAmount: todayTot,
      monthTotalAmount: monthTot,
    };
  }, [filteredStudents, monthPayments, todayKey]);

  const exportFinancialsExcel = () => {
    const rows = filteredStudents.map((s, idx) => {
      const pay = monthPayments[s.barcode];
      const fee =
        s.customMonthlyFee ??
        groupPrices[s.groupGrade] ??
        DEFAULT_GRADE_PRICES[s.groupGrade] ??
        100;

      return {
        "م": idx + 1,
        "الباركود": s.barcode,
        "اسم الطالب": s.name,
        "الصف الدراسي": s.groupGrade,
        "الاشتراك المحدد (ج.م)": fee,
        "المبلغ المسدد": pay ? pay.amount : 0,
        "حالة السداد": pay ? "مدفوع" : "غير مدفوع",
        "تاريخ وساعة السداد": pay ? `${pay.date} ${pay.time}` : "-",
        "ملاحظات": pay?.note || (s.discountReason ? `خصم: ${s.discountReason}` : "-"),
        "رقم ولي الأمر": s.parentPhone,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!views"] = [{ RTL: true }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الإيرادات والاشتراكات");
    XLSX.writeFile(workbook, `الإحصاء_المالي_${selectedMonth}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#121926]/90 border border-emerald-500/30 p-4 rounded-2xl text-center shadow-lg">
          <p className="text-xs text-emerald-400 font-semibold mb-1">الاشتراكات المدفوعة</p>
          <p className="text-2xl font-black text-emerald-400">{paidCount}</p>
        </div>

        <div className="bg-[#121926]/90 border border-rose-500/30 p-4 rounded-2xl text-center shadow-lg">
          <p className="text-xs text-rose-400 font-semibold mb-1">اشتراكات مستحقة / غير مدفوعة</p>
          <p className="text-2xl font-black text-rose-400">{unpaidCount}</p>
        </div>

        <div className="bg-[#121926]/90 border border-sky-500/30 p-4 rounded-2xl text-center shadow-lg">
          <p className="text-xs text-sky-400 font-semibold mb-1">إيراد اليوم ({todayKey})</p>
          <p className="text-2xl font-black text-sky-400 font-mono">{todayAmount} ج.م</p>
        </div>

        <div className="bg-[#121926]/90 border border-amber-500/30 p-4 rounded-2xl text-center shadow-lg">
          <p className="text-xs text-amber-400 font-semibold mb-1">إجمالي تحصيل شهر ({selectedMonth})</p>
          <p className="text-2xl font-black text-amber-400 font-mono">{monthTotalAmount} ج.م</p>
        </div>
      </div>

      {/* Filter and Date Controls */}
      <div className="bg-[#121926]/90 border border-amber-500/20 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-[#090e17] border border-amber-500/30 px-3 py-2 rounded-xl">
            <Calendar className="w-4 h-4 text-amber-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-100 outline-none cursor-pointer"
            />
          </div>

          {/* Grade filter */}
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

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "ALL" | "PAID" | "UNPAID")}
            className="bg-[#090e17] border border-amber-500/30 text-slate-100 text-xs font-bold px-3 py-2 rounded-xl outline-none"
          >
            <option value="ALL">الكل (مدفوع ومستحق)</option>
            <option value="PAID">المدفوع فقط ✅</option>
            <option value="UNPAID">المستحق وغير المدفوع فقط ❌</option>
          </select>

          {/* Smart Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-amber-400 absolute right-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم (مثال: أحمد علي) أو الباركود..."
              className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 text-xs pr-8 pl-8 py-2 rounded-xl outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all font-medium placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-2.5 top-2 p-0.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={exportFinancialsExcel}
          className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>تصدير كشف الحسابات Excel</span>
        </button>
      </div>

      {/* Financial Table */}
      <div className="bg-[#121926]/90 border border-amber-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-amber-400 font-extrabold border-b border-amber-500/30">
                <th className="p-3">م</th>
                <th className="p-3">الباركود</th>
                <th className="p-3">اسم الطالب</th>
                <th className="p-3">الصف الدراسي</th>
                <th className="p-3">الاشتراك المحدد</th>
                <th className="p-3">تاريخ ووقت السداد</th>
                <th className="p-3">المبلغ المسدد</th>
                <th className="p-3">حالة السداد</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 italic">
                    {searchQuery ? `لا توجد نتائج مطابقة لـ "${searchQuery}"` : "لا يوجد سجلات مطابقة للبحث المحدد."}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const pay = monthPayments[student.barcode];
                  const fee =
                    student.customMonthlyFee ??
                    groupPrices[student.groupGrade] ??
                    DEFAULT_GRADE_PRICES[student.groupGrade] ??
                    100;

                  return (
                    <tr key={student.barcode} className="hover:bg-amber-500/5 transition-colors">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-amber-300 font-bold">{student.barcode}</td>
                      <td className="p-3 font-bold text-slate-100">{student.name}</td>
                      <td className="p-3 text-slate-300">{student.groupGrade}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-200">{fee} ج.م</span>
                        {student.customMonthlyFee !== undefined && (
                          <span className="block text-[10px] text-purple-300">
                            (مخصص: {student.discountReason || "اشتراك مخفض"})
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-400">
                        {pay ? `${pay.date} ${pay.time}` : "-"}
                      </td>
                      <td className="p-3 font-mono font-black text-amber-300">
                        {pay ? `${pay.amount} ج.م` : "0 ج.م"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-block ${
                            pay
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          }`}
                        >
                          {pay ? "✅ تم السداد" : "❌ مستحق غير مدفوع"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {pay ? (
                            <button
                              onClick={() => {
                                const receiptMsg = `إيصال استلام اشتراك 🧾\nاسم الطالب: ${student.name}\nالصف: ${student.groupGrade}\nشهر: ${selectedMonth}\nالمبلغ المسدد: ${pay.amount} ج.م\nالتاريخ: ${pay.date}\nمع تحيات ميس إيمان الدمشيتي ✨`;
                                openWhatsApp(student.parentPhone, receiptMsg);
                              }}
                              className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold"
                            >
                              📲 إيصال واتساب
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const reminderMsg = `تذكير ودي بسداد الاشتراك 🔔\nاسم الطالب: ${student.name}\nالصف: ${student.groupGrade}\nنود تذكيركم بسداد اشتراك شهر (${selectedMonth}) وقيمته: ${fee} ج.م.\nشاكرين لكم حسن تعاونكم واهتمامكم ✨`;
                                openWhatsApp(student.parentPhone, reminderMsg);
                              }}
                              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold"
                            >
                              🔔 تذكير بالسداد
                            </button>
                          )}
                        </div>
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
