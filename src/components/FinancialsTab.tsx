import React, { useState, useMemo } from "react";
import { Student, PaymentRecord, GradeName, GRADE_ORDER } from "../types";
import { getCurrentMonthKey, getTodayKey, sortStudentsByGradeAndName, DEFAULT_GRADE_PRICES, openWhatsApp } from "../utils/helpers";
import { matchStudentSearch } from "../utils/search";
import { StudentFinancialLedgerModal } from "./StudentFinancialLedgerModal";
import { UnpaidDefaultersModal } from "./UnpaidDefaultersModal";
import { EditPaymentModal } from "./EditPaymentModal";
import * as XLSX from "xlsx";
import {
  Coins,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Search,
  Calendar,
  Tag,
  X,
  FileText,
  AlertTriangle,
  Printer,
  Edit2,
  Trash2,
  CreditCard,
} from "lucide-react";

interface FinancialsTabProps {
  students: Student[];
  payments: Record<string, Record<string, PaymentRecord>>;
  groupPrices: Record<GradeName, number>;
  onRecordPayment?: (barcode: string, amount: number, monthKey: string, note: string) => void;
  onUpdatePayment?: (
    oldMonthKey: string,
    barcode: string,
    newMonthKey: string,
    newAmount: number,
    newNote: string,
    newDate?: string
  ) => void;
  onDeletePayment?: (monthKey: string, barcode: string) => void;
}

export const FinancialsTab: React.FC<FinancialsTabProps> = ({
  students,
  payments,
  groupPrices,
  onRecordPayment,
  onUpdatePayment,
  onDeletePayment,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [filterGrade, setFilterGrade] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [ledgerModalStudent, setLedgerModalStudent] = useState<Student | null>(null);
  const [isUnpaidModalOpen, setIsUnpaidModalOpen] = useState(false);
  const [editingPaymentData, setEditingPaymentData] = useState<{
    student: Student;
    record: PaymentRecord;
    monthKey: string;
  } | null>(null);

  const todayKey = getTodayKey();
  const monthPayments = payments[selectedMonth] || {};

  const filteredStudents = useMemo(() => {
    const base = students.filter((s) => {
      if (filterGrade !== "ALL" && s.groupGrade !== filterGrade) return false;
      const isPaid = !!monthPayments[s.barcode];
      if (filterStatus === "PAID" && !isPaid) return false;
      if (filterStatus === "UNPAID" && isPaid) return false;
      return true;
    });

    if (searchQuery.trim()) {
      const scored: { student: Student; score: number }[] = [];
      for (const s of base) {
        const { match, score } = matchStudentSearch(s, searchQuery);
        if (match) {
          scored.push({ student: s, score });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.map((item) => item.student);
    }

    return sortStudentsByGradeAndName(base);
  }, [students, filterGrade, filterStatus, searchQuery, monthPayments]);

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
    <div className="space-y-6 font-tajawal">
      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="glass-card p-4.5 rounded-3xl text-center shadow-lg hover:border-emerald-400/40 transition-all duration-300">
          <p className="text-xs text-emerald-400 font-tajawal font-medium mb-1">الاشتراكات المدفوعة</p>
          <p className="text-2xl md:text-3xl font-black text-emerald-400 font-mono">{paidCount}</p>
        </div>

        <div
          onClick={() => setIsUnpaidModalOpen(true)}
          className="glass-card p-4.5 rounded-3xl text-center shadow-lg hover:border-rose-400/60 transition-all duration-300 cursor-pointer group bg-rose-500/5 hover:bg-rose-500/10"
          title="اضغط لفتح كشف الطلاب المتأخرين وتصدير PDF رسمي"
        >
          <p className="text-xs text-rose-400 font-tajawal font-medium mb-1 flex items-center justify-center gap-1">
            <span>اشتراكات مستحقة / غير مدفوعة</span>
            <Printer className="w-3 h-3 group-hover:scale-110 transition-transform text-rose-400" />
          </p>
          <p className="text-2xl md:text-3xl font-black text-rose-400 font-mono">{unpaidCount}</p>
          <span className="text-[10px] text-rose-300/80 font-bold block mt-0.5">اضغط لطباعة كشف PDF 🖨️</span>
        </div>

        <div className="glass-card p-4.5 rounded-3xl text-center shadow-lg hover:border-sky-400/40 transition-all duration-300">
          <p className="text-xs text-sky-400 font-tajawal font-medium mb-1">إيراد اليوم ({todayKey})</p>
          <p className="text-2xl md:text-3xl font-black text-sky-400 font-mono">{todayAmount} <span className="text-sm font-tajawal font-normal text-slate-400">ج.م</span></p>
        </div>

        <div className="glass-card p-4.5 rounded-3xl text-center shadow-lg hover:border-amber-400/40 transition-all duration-300">
          <p className="text-xs text-amber-400 font-tajawal font-medium mb-1">إجمالي تحصيل شهر ({selectedMonth})</p>
          <p className="text-2xl md:text-3xl font-black text-amber-300 font-mono">{monthTotalAmount} <span className="text-sm font-tajawal font-normal text-slate-400">ج.م</span></p>
        </div>
      </div>

      {/* Filter and Action Controls */}
      <div className="glass-panel p-4 md:p-5 rounded-3xl flex flex-wrap items-center justify-between gap-3.5 shadow-xl font-tajawal">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-[#080d1e] border border-indigo-500/30 px-3.5 py-2.5 rounded-2xl">
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
            className="bg-[#080d1e] border border-indigo-500/30 text-slate-100 text-xs font-bold px-3.5 py-2.5 rounded-2xl outline-none"
          >
            <option value="ALL" className="bg-slate-900 text-white">كل الصفوف الدراسية</option>
            {GRADE_ORDER.map((g) => (
              <option key={g} value={g} className="bg-slate-900 text-white">
                {g}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "ALL" | "PAID" | "UNPAID")}
            className="bg-[#080d1e] border border-indigo-500/30 text-slate-100 text-xs font-bold px-3.5 py-2.5 rounded-2xl outline-none"
          >
            <option value="ALL" className="bg-slate-900 text-white">الكل (مدفوع ومستحق)</option>
            <option value="PAID" className="bg-slate-900 text-white">المدفوع فقط ✅</option>
            <option value="UNPAID" className="bg-slate-900 text-white">المستحق وغير المدفوع فقط ❌</option>
          </select>

          {/* Smart Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-amber-400 absolute right-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم (مثال: أحمد علي) أو الباركود..."
              className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-100 text-xs pr-9 pl-8 py-2.5 rounded-2xl outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all font-medium placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-2.5 top-2.5 p-0.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsUnpaidModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-rose-900/30 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>كشف غير المسددين (PDF رسمي لكل صف)</span>
          </button>

          <button
            onClick={exportFinancialsExcel}
            className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Financial Table */}
      <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs md:text-sm font-tajawal">
            <thead>
              <tr className="bg-slate-900/90 text-amber-400 font-bold border-b border-indigo-500/30">
                <th className="p-3.5">م</th>
                <th className="p-3.5">الباركود</th>
                <th className="p-3.5">اسم الطالب</th>
                <th className="p-3.5">الصف الدراسي</th>
                <th className="p-3.5">الاشتراك المحدد</th>
                <th className="p-3.5">تاريخ ووقت السداد</th>
                <th className="p-3.5">المبلغ المسدد</th>
                <th className="p-3.5">حالة السداد</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-950/50">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
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
                    <tr key={student.barcode} className="hover:bg-indigo-500/10 transition-colors font-medium">
                      <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3.5 font-mono text-amber-300 font-bold">{student.barcode}</td>
                      <td className="p-3.5 font-bold text-slate-100">{student.name}</td>
                      <td className="p-3.5 text-slate-300">{student.groupGrade}</td>
                      <td className="p-3.5">
                        <span className="font-bold text-slate-200">{fee} ج.م</span>
                        {student.customMonthlyFee !== undefined && (
                          <span className="block text-[10px] text-amber-300/80">
                            (مخصص: {student.discountReason || "اشتراك مخفض"})
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">
                        {pay ? `${pay.date} ${pay.time}` : "-"}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-amber-300">
                        {pay ? `${pay.amount} ج.م` : "0 ج.م"}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border inline-block ${
                            pay
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          }`}
                        >
                          {pay ? "✅ تم السداد" : "❌ مستحق غير مدفوع"}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setLedgerModalStudent(student)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
                            title="عرض كشف الحساب المالي المفصل وسجل شهور العام"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span>كشف الحساب 📊</span>
                          </button>

                          {pay ? (
                            <>
                              {onUpdatePayment && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingPaymentData({
                                      student,
                                      record: pay,
                                      monthKey: selectedMonth,
                                    })
                                  }
                                  className="px-2 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
                                  title="تعديل هذا السداد أو تحويله لشهر آخر"
                                >
                                  <Edit2 className="w-3 h-3 text-amber-400" />
                                  <span>تعديل ✏️</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  const receiptMsg = `إيصال استلام اشتراك 🧾\nمنظومة الأستاذة إيمان الدمشيتي - رياضيات 📐\nاسم الطالب: ${student.name}\nالصف: ${student.groupGrade}\nعن شهر: ${selectedMonth}\nالمبلغ المسدد: ${pay.amount} ج.م\nالتاريخ: ${pay.date}\nمع تحيات ميس إيمان الدمشيتي ✨`;
                                  openWhatsApp(student.parentPhone, receiptMsg);
                                }}
                                className="px-2 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold cursor-pointer transition-all"
                              >
                                📲 إيصال
                              </button>
                            </>
                          ) : (
                            <>
                              {onRecordPayment && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `هل تود إثبات سداد مبلغ (${fee} ج.م) عن شهر (${selectedMonth}) للطالب (${student.name})؟`
                                      )
                                    ) {
                                      onRecordPayment(
                                        student.barcode,
                                        fee,
                                        selectedMonth,
                                        `سداد اشتراك ${selectedMonth}`
                                      );
                                    }
                                  }}
                                  className="px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 shadow-sm"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  <span>سداد 💳</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  const reminderMsg = `تذكير ودي بسداد الاشتراك 🔔\nمنظومة الأستاذة إيمان الدمشيتي - رياضيات 📐\nاسم الطالب: ${student.name}\nالصف: ${student.groupGrade}\nنود تذكيركم بسداد اشتراك شهر (${selectedMonth}) وقيمته: ${fee} ج.م.\nشاكرين لكم حسن تعاونكم واهتمامكم ✨`;
                                  openWhatsApp(student.parentPhone, reminderMsg);
                                }}
                                className="px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold cursor-pointer transition-all"
                              >
                                🔔 تذكير
                              </button>
                            </>
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

      {/* Student Detailed Financial Ledger Modal */}
      {ledgerModalStudent && (
        <StudentFinancialLedgerModal
          student={ledgerModalStudent}
          payments={payments}
          groupPrices={groupPrices}
          isOpen={!!ledgerModalStudent}
          onClose={() => setLedgerModalStudent(null)}
          onRecordQuickPayment={onRecordPayment}
          onUpdatePayment={onUpdatePayment}
          onDeletePayment={onDeletePayment}
        />
      )}

      {/* Unpaid Defaulters Official PDF & Multi-Grade Modal */}
      <UnpaidDefaultersModal
        students={students}
        payments={payments}
        groupPrices={groupPrices}
        isOpen={isUnpaidModalOpen}
        onClose={() => setIsUnpaidModalOpen(false)}
        onRecordPayment={onRecordPayment}
      />

      {/* Edit Payment Modal */}
      {editingPaymentData && onUpdatePayment && (
        <EditPaymentModal
          isOpen={!!editingPaymentData}
          student={editingPaymentData.student}
          payment={editingPaymentData.record}
          monthKey={editingPaymentData.monthKey}
          onClose={() => setEditingPaymentData(null)}
          onSave={(oldMonthKey, barcode, newMonthKey, newAmount, newNote, newDate) => {
            onUpdatePayment(oldMonthKey, barcode, newMonthKey, newAmount, newNote, newDate);
            setEditingPaymentData(null);
          }}
          onDelete={(monthKey, barcode) => {
            if (onDeletePayment) {
              onDeletePayment(monthKey, barcode);
            }
            setEditingPaymentData(null);
          }}
        />
      )}
    </div>
  );
};
