import React, { useState, useMemo } from "react";
import { Student, GradeName, GroupDays, GRADE_ORDER, PaymentRecord } from "../types";
import { sortStudentsByGradeAndName, getExamAverage, getAbsenceRate, DEFAULT_GRADE_PRICES } from "../utils/helpers";
import { matchStudentSearch } from "../utils/search";
import { StudentFinancialLedgerModal } from "./StudentFinancialLedgerModal";
import { Users2, Trash2, Edit3, Search, AlertTriangle, Tag, Sparkles, X, CreditCard, FileText } from "lucide-react";

interface ManageStudentsTabProps {
  students: Student[];
  payments?: Record<string, Record<string, PaymentRecord>>;
  groupPrices?: Record<GradeName, number>;
  onUpdateStudent: (oldBarcode: string, updated: Student) => void;
  onDeleteStudent: (barcode: string) => void;
  onClearAllData: () => void;
  onOpenPrintCards?: () => void;
  onRecordPayment?: (barcode: string, amount: number, monthKey: string, note: string) => void;
}

export const ManageStudentsTab: React.FC<ManageStudentsTabProps> = ({
  students,
  payments = {},
  groupPrices = {} as Record<GradeName, number>,
  onUpdateStudent,
  onDeleteStudent,
  onClearAllData,
  onOpenPrintCards,
  onRecordPayment,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [oldBarcode, setOldBarcode] = useState("");
  const [ledgerModalStudent, setLedgerModalStudent] = useState<Student | null>(null);

  const sortedStudents = useMemo(() => {
    let result = students.filter((s) => {
      if (!searchQuery.trim()) return true;
      const { match } = matchStudentSearch(s, searchQuery);
      return match;
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
  }, [students, searchQuery]);

  const handleOpenEdit = (student: Student) => {
    setOldBarcode(student.barcode);
    setEditingStudent({ ...student });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    if (
      oldBarcode !== editingStudent.barcode &&
      students.some((s) => s.barcode === editingStudent.barcode)
    ) {
      alert("⚠️ هذا الباركود الجديد مستخدم بالفعل لطالب آخر!");
      return;
    }

    onUpdateStudent(oldBarcode, editingStudent);
    alert("✅ تم تحديث بيانات الطالب بنجاح!");
    setEditingStudent(null);
  };

  const handleDeleteClick = (student: Student) => {
    if (confirm(`هل أنت متأكد من حذف الطالب (${student.name}) نهائياً من المنظومة؟`)) {
      onDeleteStudent(student.barcode);
    }
  };

  const handleClearAll = () => {
    if (
      confirm(
        "🚨 تحذير خطير جداً: هل أنت متأكد من مسح جميع بيانات الطلاب والسجلات نهائياً؟ لا يمكن التراجع عن هذه الخطوة!"
      )
    ) {
      const typed = prompt("اكتب كلمة (مسح) للتأكيد النهائي:");
      if (typed === "مسح") {
        onClearAllData();
      }
    }
  };

  return (
    <div className="space-y-6 font-tajawal">
      {/* Header Bar */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-md">
            <Users2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-fancy text-amber-300">
              لوحة التحكم وتعديل بيانات الطلاب
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تعديل الأكواد والاشتراكات المخصصة أو حذف الطلاب من المنظومة (<span className="font-mono text-amber-300">{students.length}</span> طالب)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenPrintCards && (
            <button
              type="button"
              onClick={onOpenPrintCards}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 hover:from-amber-300 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer active:scale-95"
            >
              <CreditCard className="w-4 h-4" />
              <span>🪪 طباعة كروت الباركود (PDF)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearAll}
            className="px-4 py-2.5 bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-2xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>مسح كافة البيانات (أدمن)</span>
          </button>
        </div>
      </div>

      {/* Smart Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-amber-400/60 absolute right-3.5 top-3.5 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث بالاسم (مثال: أحمد علي)، التليفون، أو الباركود..."
          className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-100 text-xs px-4 pr-10 pl-8 py-3 rounded-2xl outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 font-medium transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute left-3 top-3 p-0.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Students Management Table */}
      <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl border-indigo-500/20">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-amber-300 font-bold font-fancy border-b border-indigo-500/20">
                <th className="p-3.5">م</th>
                <th className="p-3.5">الباركود</th>
                <th className="p-3.5">اسم الطالب</th>
                <th className="p-3.5">الصف الدراسي</th>
                <th className="p-3.5">المجموعة</th>
                <th className="p-3.5">الاشتراك المحدد</th>
                <th className="p-3.5">رقم ولي الأمر</th>
                <th className="p-3.5">النقاط ⭐</th>
                <th className="p-3.5">متوسط الدرجات</th>
                <th className="p-3.5 text-center">إجراءات التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {sortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                    {searchQuery ? `لا توجد نتائج مطابقة لـ "${searchQuery}"` : "لا يوجد طلاب مطابقين للبحث."}
                  </td>
                </tr>
              ) : (
                sortedStudents.map((student, idx) => {
                  const examAvg = getExamAverage(student);

                  return (
                    <tr key={student.barcode} className="hover:bg-amber-500/5 transition-colors">
                      <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3.5 font-mono text-amber-300 font-bold">#{student.barcode}</td>
                      <td className="p-3.5 font-bold text-slate-100 font-fancy">{student.name}</td>
                      <td className="p-3.5 text-slate-300">{student.groupGrade}</td>
                      <td className="p-3.5 text-slate-400">{student.groupDays}</td>
                      <td className="p-3.5">
                        <span
                          className={`font-bold ${
                            student.customMonthlyFee !== undefined
                              ? "text-purple-300"
                              : "text-slate-400"
                          }`}
                        >
                          {student.customMonthlyFee !== undefined
                            ? `${student.customMonthlyFee} ج.م (مخصص)`
                            : "الافتراضي"}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">{student.parentPhone}</td>
                      <td className="p-3.5 font-bold text-amber-300 font-mono">{student.points || 0}</td>
                      <td className="p-3.5 font-bold text-emerald-400 font-mono">{examAvg}%</td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setLedgerModalStudent(student)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                            title="عرض كشف الحساب المالي المفصل للطالب"
                          >
                            <FileText className="w-3 h-3 text-amber-400" />
                            <span>سجل الحساب</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(student)}
                            className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteClick(student)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف</span>
                          </button>
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

      {/* Edit Student Full Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel border-amber-500/40 p-6 md:p-8 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 my-auto animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold font-fancy text-amber-300 border-b border-indigo-500/20 pb-3 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>تعديل بيانات الطالب والاشتراك الشهري</span>
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-bold font-tajawal">
              <div className="space-y-1.5">
                <label className="text-slate-300">باركود الطالب *</label>
                <input
                  type="text"
                  required
                  value={editingStudent.barcode}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, barcode: e.target.value })
                  }
                  className="w-full bg-[#080d1e] border border-amber-400 text-amber-300 font-mono px-4 py-2.5 rounded-2xl outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300">اسم الطالب ثلاثي *</label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, name: e.target.value })
                  }
                  className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-100 px-4 py-2.5 rounded-2xl outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-300">رقم الطالب</label>
                  <input
                    type="text"
                    value={editingStudent.phone}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, phone: e.target.value })
                    }
                    className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-200 px-4 py-2.5 rounded-2xl font-mono outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-300">رقم ولي الأمر *</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.parentPhone}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, parentPhone: e.target.value })
                    }
                    className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-200 px-4 py-2.5 rounded-2xl font-mono outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-300">الصف الدراسي</label>
                  <select
                    value={editingStudent.groupGrade}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        groupGrade: e.target.value as GradeName,
                      })
                    }
                    className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-200 px-4 py-2.5 rounded-2xl outline-none"
                  >
                    {GRADE_ORDER.map((g) => (
                      <option key={g} value={g} className="bg-slate-900 text-white">
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300">أيام المجموعة</label>
                  <select
                    value={editingStudent.groupDays}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        groupDays: e.target.value as GroupDays,
                      })
                    }
                    className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-200 px-4 py-2.5 rounded-2xl outline-none"
                  >
                    <option value="سبت - إثنين - أربعاء" className="bg-slate-900 text-white">سبت - إثنين - أربعاء</option>
                    <option value="أحد - ثلاثاء - خميس" className="bg-slate-900 text-white">أحد - ثلاثاء - خميس</option>
                  </select>
                </div>
              </div>

              {/* Custom Monthly Fee Override */}
              <div className="glass-card p-3.5 rounded-2xl border-amber-500/30 space-y-2">
                <label className="text-amber-300 text-xs block">
                  الاشتراك الشهري المخصص للطالب (ج.م) - اتركه فارغاً للاعتماد على سعر الصف الافتراضي:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={editingStudent.customMonthlyFee ?? ""}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        customMonthlyFee:
                          e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="مثال: 50 أو 60 أو 70 أو 80"
                    className="w-full bg-[#080d1e] border border-amber-400 text-amber-300 px-3 py-2 rounded-xl font-bold font-mono outline-none"
                  />

                  <input
                    type="text"
                    value={editingStudent.discountReason ?? ""}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        discountReason: e.target.value || undefined,
                      })
                    }
                    placeholder="سبب الخصم / ملاحظات"
                    className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-200 px-3 py-2 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-800/80 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 hover:from-amber-300 text-slate-950 font-black cursor-pointer shadow-md active:scale-95"
                >
                  حفظ وتحديث البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Detailed Financial Ledger Modal */}
      {ledgerModalStudent && (
        <StudentFinancialLedgerModal
          student={ledgerModalStudent}
          payments={payments}
          groupPrices={groupPrices}
          isOpen={!!ledgerModalStudent}
          onClose={() => setLedgerModalStudent(null)}
          onRecordQuickPayment={onRecordPayment}
        />
      )}
    </div>
  );
};
