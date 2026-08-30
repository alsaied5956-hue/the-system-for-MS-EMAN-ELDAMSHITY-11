import React, { useState, useMemo } from "react";
import { Student, GradeName, GRADE_ORDER } from "../types";
import { getAttendanceRate, getAbsenceRate, getExamAverage, sortStudentsByGradeAndName, openWhatsApp } from "../utils/helpers";
import { matchStudentSearch } from "../utils/search";
import { exportAllExamsToExcel } from "../utils/excel";
import { Award, FileSpreadsheet, FileText, Search, Edit3, Star, X } from "lucide-react";

interface CumulativeGradesReportProps {
  students: Student[];
  onUpdateGradeRecord: (
    barcode: string,
    lastTitle: string,
    lastScore: string,
    newPoints: number,
    updatedScores: number[]
  ) => void;
  onOpenPdfModal: (type: "exams") => void;
}

export const CumulativeGradesReport: React.FC<CumulativeGradesReportProps> = ({
  students,
  onUpdateGradeRecord,
  onOpenPdfModal,
}) => {
  const [filterGrade, setFilterGrade] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [editingStudent, setEditingStudent] = useState<{
    barcode: string;
    name: string;
    lastTitle: string;
    lastScore: string;
    points: number;
    rawScoresStr: string;
  } | null>(null);

  const filteredStudents = useMemo(() => {
    let result = students.filter((s) => {
      if (filterGrade !== "ALL" && s.groupGrade !== filterGrade) return false;
      if (searchQuery.trim()) {
        const { match } = matchStudentSearch(s, searchQuery);
        return match;
      }
      return true;
    });

    if (searchQuery.trim()) {
      // Sort by search match score
      result = [...result].sort((a, b) => {
        const scoreA = matchStudentSearch(a, searchQuery).score;
        const scoreB = matchStudentSearch(b, searchQuery).score;
        return scoreB - scoreA;
      });
      return result;
    }

    return sortStudentsByGradeAndName(result);
  }, [students, filterGrade, searchQuery]);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    // Parse array of scores
    const parsedScores = editingStudent.rawScoresStr
      .split(",")
      .map((n) => Number(n.trim()))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 100);

    onUpdateGradeRecord(
      editingStudent.barcode,
      editingStudent.lastTitle.trim(),
      editingStudent.lastScore.trim(),
      editingStudent.points,
      parsedScores
    );

    setEditingStudent(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="glass-panel p-5 md:p-6 rounded-3xl shadow-xl flex flex-wrap items-center justify-between gap-3 font-tajawal">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {/* Smart Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-amber-400/70 absolute right-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث ذكي بالاسم (مثال: أحمد علي) أو الباركود..."
              className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-100 text-xs pr-10 pl-8 py-3 rounded-2xl outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all placeholder:text-slate-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-3 p-0.5 text-slate-400 hover:text-white cursor-pointer"
                title="مسح"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="bg-[#080d1e] border border-indigo-500/30 text-slate-100 text-xs font-bold px-4 py-3 rounded-2xl outline-none"
          >
            <option value="ALL">كل الصفوف الدراسية</option>
            {GRADE_ORDER.map((g) => (
              <option key={g} value={g} className="bg-slate-900 text-white">
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportAllExamsToExcel(filteredStudents)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير الدرجات Excel</span>
          </button>

          <button
            onClick={() => onOpenPdfModal("exams")}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 hover:from-amber-300 hover:to-yellow-100 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-950" />
            <span>📄 تصدير PDF مقسم لكل صف</span>
          </button>
        </div>
      </div>

      {/* Cumulative Table */}
      <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs font-tajawal">
            <thead>
              <tr className="bg-slate-950/60 text-amber-300 font-extrabold border-b border-indigo-500/20 font-fancy">
                <th className="p-3.5">م</th>
                <th className="p-3.5">الباركود</th>
                <th className="p-3.5">اسم الطالب</th>
                <th className="p-3.5">الصف الدراسي</th>
                <th className="p-3.5">آخر امتحان ودرجته</th>
                <th className="p-3.5">نسبة الحضور</th>
                <th className="p-3.5">نسبة الغياب</th>
                <th className="p-3.5">متوسط درجات الاختبارات</th>
                <th className="p-3.5">إجمالي النقاط ⭐</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-500/10 font-medium">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                    {searchQuery ? `لا توجد نتائج مطابقة لـ "${searchQuery}"` : "لا يوجد طلاب مطابقين للبحث."}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const attRate = getAttendanceRate(student);
                  const absRate = getAbsenceRate(student);
                  const examAvg = getExamAverage(student);

                  return (
                    <tr key={student.barcode} className="hover:bg-amber-500/5 transition-colors">
                      <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3.5 font-mono text-amber-300 font-bold">{student.barcode}</td>
                      <td className="p-3.5 font-bold text-slate-100">{student.name}</td>
                      <td className="p-3.5 text-slate-300">{student.groupGrade}</td>
                      <td className="p-3.5">
                        {student.lastExamScore ? (
                          <div className="font-bold text-amber-300">
                            <span className="text-slate-300 text-[11px] block">
                              {student.lastExamTitle || "امتحان"}
                            </span>
                            {student.lastExamScore}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">لا يوجد</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-emerald-400">{attRate}%</span>
                      </td>
                      <td className="p-3.5">
                        <span className={`font-bold ${absRate > 20 ? "text-rose-400" : "text-slate-400"}`}>
                          {absRate}%
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`font-black px-2.5 py-1 rounded-xl text-xs ${
                            examAvg >= 85
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : examAvg >= 65
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {examAvg}%
                        </span>
                      </td>
                      <td className="p-3.5 font-black text-amber-300">
                        <span className="flex items-center gap-1 font-mono">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {student.points || 0}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() =>
                              setEditingStudent({
                                barcode: student.barcode,
                                name: student.name,
                                lastTitle: student.lastExamTitle || "",
                                lastScore: student.lastExamScore || "",
                                points: student.points || 0,
                                rawScoresStr: (student.totalExamScores || []).join(", "),
                              })
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>

                          <button
                            onClick={() => {
                              const reportMsg = `تقرير مستوى الطالب/ة: (${student.name})\nالصف: ${student.groupGrade}\nنسبة الحضور: ${attRate}%\nمتوسط درجات الامتحانات: ${examAvg}%\nآخر اختبار: ${
                                student.lastExamScore || "لا يوجد"
                              }\nإجمالي النقاط: ${student.points} ⭐\nمع تحيات ميس إيمان الدمشيتي 📐`;
                              openWhatsApp(student.parentPhone, reportMsg);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold cursor-pointer transition-all"
                          >
                            📲 واتساب
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

      {/* Edit Student Grades Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 md:p-8 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 font-tajawal">
            <h3 className="text-lg font-bold font-fancy text-amber-300 border-b border-indigo-500/20 pb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span>تعديل درجات ونقاط الطالب</span>
            </h3>

            <p className="text-xs text-slate-300">
              اسم الطالب: <span className="font-bold text-amber-300 text-sm font-fancy">{editingStudent.name}</span>
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs font-bold">
              <div className="space-y-1.5">
                <label className="text-slate-300">عنوان آخر امتحان مسجل:</label>
                <input
                  type="text"
                  required
                  value={editingStudent.lastTitle}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, lastTitle: e.target.value })
                  }
                  placeholder="مثال: امتحان شهر أكتوبر"
                  className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-100 px-4 py-2.5 rounded-2xl outline-none focus:border-amber-400 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300">النتيجة المسجلة:</label>
                <input
                  type="text"
                  required
                  value={editingStudent.lastScore}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, lastScore: e.target.value })
                  }
                  placeholder="مثال: 45 من 50 (90%)"
                  className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-100 px-4 py-2.5 rounded-2xl outline-none focus:border-amber-400 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300">إجمالي النقاط ⭐:</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editingStudent.points}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, points: Number(e.target.value) })
                  }
                  className="w-full bg-[#080d1e] border border-amber-500/30 text-amber-300 font-mono font-black px-4 py-2.5 rounded-2xl outline-none focus:border-amber-400 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300">
                  سجل النسب المئوية لكافة الامتحانات (مفصولة بفاصلة):
                </label>
                <input
                  type="text"
                  value={editingStudent.rawScoresStr}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, rawScoresStr: e.target.value })
                  }
                  placeholder="مثال: 90, 85, 95"
                  className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-200 px-4 py-2.5 rounded-2xl font-mono text-xs outline-none focus:border-amber-400 transition-all"
                />
                <span className="text-[10px] text-slate-400 block font-normal">
                  هذه القيم تستخدم لحساب متوسط درجات الطالب التراكمي بدقة.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-indigo-500/20">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 text-slate-950 font-black cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
