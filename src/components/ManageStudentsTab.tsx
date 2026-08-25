import React, { useState, useMemo } from "react";
import { Student, GradeName, GroupDays, GRADE_ORDER } from "../types";
import { sortStudentsByGradeAndName, getExamAverage, getAbsenceRate, DEFAULT_GRADE_PRICES } from "../utils/helpers";
import { matchStudentSearch } from "../utils/search";
import { Users2, Trash2, Edit3, Search, AlertTriangle, Tag, Sparkles, X, CreditCard } from "lucide-react";

interface ManageStudentsTabProps {
  students: Student[];
  onUpdateStudent: (oldBarcode: string, updated: Student) => void;
  onDeleteStudent: (barcode: string) => void;
  onClearAllData: () => void;
  onOpenPrintCards?: () => void;
}

export const ManageStudentsTab: React.FC<ManageStudentsTabProps> = ({
  students,
  onUpdateStudent,
  onDeleteStudent,
  onClearAllData,
  onOpenPrintCards,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [oldBarcode, setOldBarcode] = useState("");

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
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#121926]/90 border border-amber-500/30 p-5 rounded-2xl shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl">
            <Users2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-400">
              لوحة التحكم وتعديل بيانات الطلاب
            </h2>
            <p className="text-xs text-slate-400">
              تعديل الأكواد والاشتراكات المخصصة أو حذف الطلاب من المنظومة ({students.length} طالب)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenPrintCards && (
            <button
              type="button"
              onClick={onOpenPrintCards}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all transform hover:scale-105 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>🪪 طباعة كروت الباركود (PDF)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearAll}
            className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
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
          className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 text-xs px-4 pr-10 pl-8 py-3 rounded-xl outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 font-medium transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute left-3 top-3 p-0.5 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Students Management Table */}
      <div className="bg-[#121926]/90 border border-amber-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-amber-400 font-extrabold border-b border-amber-500/30">
                <th className="p-3">م</th>
                <th className="p-3">الباركود</th>
                <th className="p-3">اسم الطالب</th>
                <th className="p-3">الصف الدراسي</th>
                <th className="p-3">المجموعة</th>
                <th className="p-3">الاشتراك المحدد</th>
                <th className="p-3">رقم ولي الأمر</th>
                <th className="p-3">النقاط ⭐</th>
                <th className="p-3">متوسط الدرجات</th>
                <th className="p-3 text-center">إجراءات التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {sortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400 italic">
                    {searchQuery ? `لا توجد نتائج مطابقة لـ "${searchQuery}"` : "لا يوجد طلاب مطابقين للبحث."}
                  </td>
                </tr>
              ) : (
                sortedStudents.map((student, idx) => {
                  const examAvg = getExamAverage(student);

                  return (
                    <tr key={student.barcode} className="hover:bg-amber-500/5 transition-colors">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-amber-300 font-bold">{student.barcode}</td>
                      <td className="p-3 font-bold text-slate-100">{student.name}</td>
                      <td className="p-3 text-slate-300">{student.groupGrade}</td>
                      <td className="p-3 text-slate-400">{student.groupDays}</td>
                      <td className="p-3">
                        <span
                          className={`font-bold ${
                            student.customMonthlyFee !== undefined
                              ? "text-purple-400"
                              : "text-slate-400"
                          }`}
                        >
                          {student.customMonthlyFee !== undefined
                            ? `${student.customMonthlyFee} ج.م (مخصص)`
                            : "الافتراضي"}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{student.parentPhone}</td>
                      <td className="p-3 font-bold text-amber-400">{student.points || 0}</td>
                      <td className="p-3 font-bold text-emerald-400">{examAvg}%</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(student)}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteClick(student)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121926] border border-amber-500/40 p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4 my-auto animate-in fade-in zoom-in-95">
            <h3 className="text-base font-extrabold text-amber-400 border-b border-amber-500/20 pb-2 flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              <span>تعديل بيانات الطالب والاشتراك الشهري</span>
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-slate-300">باركود الطالب *</label>
                <input
                  type="text"
                  required
                  value={editingStudent.barcode}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, barcode: e.target.value })
                  }
                  className="w-full bg-[#090e17] border border-amber-400 text-amber-300 font-mono px-3 py-2 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">اسم الطالب ثلاثي *</label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, name: e.target.value })
                  }
                  className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 px-3 py-2 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">رقم الطالب</label>
                  <input
                    type="text"
                    value={editingStudent.phone}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, phone: e.target.value })
                    }
                    className="w-full bg-[#090e17] border border-slate-700 text-slate-200 px-3 py-2 rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">رقم ولي الأمر *</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.parentPhone}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, parentPhone: e.target.value })
                    }
                    className="w-full bg-[#090e17] border border-slate-700 text-slate-200 px-3 py-2 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">الصف الدراسي</label>
                  <select
                    value={editingStudent.groupGrade}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        groupGrade: e.target.value as GradeName,
                      })
                    }
                    className="w-full bg-[#090e17] border border-slate-700 text-slate-200 px-3 py-2 rounded-xl"
                  >
                    {GRADE_ORDER.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">أيام المجموعة</label>
                  <select
                    value={editingStudent.groupDays}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        groupDays: e.target.value as GroupDays,
                      })
                    }
                    className="w-full bg-[#090e17] border border-slate-700 text-slate-200 px-3 py-2 rounded-xl"
                  >
                    <option value="سبت - إثنين - أربعاء">سبت - إثنين - أربعاء</option>
                    <option value="أحد - ثلاثاء - خميس">أحد - ثلاثاء - خميس</option>
                  </select>
                </div>
              </div>

              {/* Custom Monthly Fee Override */}
              <div className="bg-[#090e17] p-3 rounded-xl border border-amber-500/20 space-y-2">
                <label className="text-amber-300 text-[11px] block">
                  الاشتراك الشهري المخصص للطالب (ج.م) - اتركه فارغاً للاعتماد على سعر الصف الافتراضي:
                </label>
                <div className="grid grid-cols-2 gap-2">
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
                    className="w-full bg-[#121926] border border-amber-400 text-amber-300 px-3 py-1.5 rounded-lg font-bold"
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
                    className="w-full bg-[#121926] border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black"
                >
                  حفظ وتحديث البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
