import React, { useState, useMemo } from "react";
import { Student, GradeName, GroupDays, GRADE_ORDER } from "../types";
import { getTodayKey, openWhatsApp, sortStudentsByGradeAndName } from "../utils/helpers";
import { matchStudentSearch } from "../utils/search";
import { exportAttendanceHistoryToExcel } from "../utils/excel";
import { Calendar, Filter, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, XCircle, Edit3, Search, X } from "lucide-react";

interface DailyAttendanceReportProps {
  students: Student[];
  attendanceHistory: Record<string, Record<string, string>>;
  onUpdateStatus: (barcode: string, dateKey: string, newStatus: string) => void;
  onOpenPdfModal: (type: "attendance") => void;
}

export const DailyAttendanceReport: React.FC<DailyAttendanceReportProps> = ({
  students,
  attendanceHistory,
  onUpdateStatus,
  onOpenPdfModal,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKey());
  const [filterGrade, setFilterGrade] = useState<string>("ALL");
  const [filterDays, setFilterDays] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [editingStudent, setEditingStudent] = useState<{ barcode: string; name: string; currentStatus: string } | null>(null);
  const [newStatusSelect, setNewStatusSelect] = useState("حضور");

  const dateAttendanceMap = attendanceHistory[selectedDate] || {};

  const filteredStudents = useMemo(() => {
    let result = students.filter((s) => {
      if (filterGrade !== "ALL" && s.groupGrade !== filterGrade) return false;
      if (filterDays !== "ALL" && s.groupDays !== filterDays) return false;
      if (searchQuery.trim()) {
        const { match } = matchStudentSearch(s, searchQuery);
        return match;
      }
      return true;
    });

    if (searchQuery.trim()) {
      // Sort by relevance score if searching
      result = [...result].sort((a, b) => {
        const scoreA = matchStudentSearch(a, searchQuery).score;
        const scoreB = matchStudentSearch(b, searchQuery).score;
        return scoreB - scoreA;
      });
      return result;
    }

    return sortStudentsByGradeAndName(result);
  }, [students, filterGrade, filterDays, searchQuery]);

  const { presentCount, lateCount, absentCount } = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;

    filteredStudents.forEach((s) => {
      const st = dateAttendanceMap[s.barcode];
      if (st === "حضور") present++;
      else if (st === "تأخير") late++;
      else if (st === "غائب") absent++;
    });

    return { presentCount: present, lateCount: late, absentCount: absent };
  }, [filteredStudents, dateAttendanceMap]);

  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    onUpdateStatus(editingStudent.barcode, selectedDate, newStatusSelect);
    setEditingStudent(null);
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#121926]/90 border border-amber-500/20 p-4 rounded-2xl text-center shadow-lg">
          <p className="text-xs text-slate-400 font-semibold mb-1">الطلاب المحددين</p>
          <p className="text-2xl font-black text-amber-400">{filteredStudents.length}</p>
        </div>
        <div className="bg-[#121926]/90 border border-emerald-500/30 p-4 rounded-2xl text-center shadow-lg">
          <p className="text-xs text-emerald-400 font-semibold mb-1">🟢 حضور تام</p>
          <p className="text-2xl font-black text-emerald-400">{presentCount}</p>
        </div>
        <div className="bg-[#121926]/90 border border-amber-500/30 p-4 rounded-2xl text-center shadow-lg">
          <p className="text-xs text-amber-400 font-semibold mb-1">🟡 تأخير</p>
          <p className="text-2xl font-black text-amber-400">{lateCount}</p>
        </div>
        <div className="bg-[#121926]/90 border border-rose-500/30 p-4 rounded-2xl text-center shadow-lg">
          <p className="text-xs text-rose-400 font-semibold mb-1">🔴 غائب</p>
          <p className="text-2xl font-black text-rose-400">{absentCount}</p>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="bg-[#121926]/90 border border-amber-500/20 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-[#090e17] border border-amber-500/30 px-3 py-2 rounded-xl">
            <Calendar className="w-4 h-4 text-amber-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-100 outline-none cursor-pointer"
            />
          </div>

          {/* Filter Grade */}
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

          {/* Filter Days */}
          <select
            value={filterDays}
            onChange={(e) => setFilterDays(e.target.value)}
            className="bg-[#090e17] border border-amber-500/30 text-slate-100 text-xs font-bold px-3 py-2 rounded-xl outline-none"
          >
            <option value="ALL">كل الأيام</option>
            <option value="سبت - إثنين - أربعاء">سبت - إثنين - أربعاء</option>
            <option value="أحد - ثلاثاء - خميس">أحد - ثلاثاء - خميس</option>
          </select>

          {/* Seamless Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-amber-400 absolute right-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم (مثال: أحمد علي) أو الباركود..."
              className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 text-xs pr-8 pl-8 py-2 rounded-xl outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all placeholder:text-slate-500 font-medium"
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

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportAttendanceHistoryToExcel(filteredStudents, dateAttendanceMap, selectedDate)}
            className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير Excel</span>
          </button>

          <button
            onClick={() => onOpenPdfModal("attendance")}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <FileText className="w-4 h-4" />
            <span>📄 تصدير PDF مقسم لكل صف</span>
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-[#121926]/90 border border-amber-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-amber-400 font-extrabold border-b border-amber-500/30">
                <th className="p-3">م</th>
                <th className="p-3">الباركود</th>
                <th className="p-3">اسم الطالب</th>
                <th className="p-3">الصف الدراسي</th>
                <th className="p-3">المجموعة</th>
                <th className="p-3">حالة الحضور بتاريـخ ({selectedDate})</th>
                <th className="p-3">رقم ولي الأمر</th>
                <th className="p-3 text-center">إجراء وتعديل الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                    {searchQuery ? `لا يوجد نتائج مطابقة للبحث "${searchQuery}"` : "لا يوجد طلاب مطابقين للتصفية المحددة."}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const status = dateAttendanceMap[student.barcode] || "لم يسجل";
                  let statusBg = "bg-slate-800 text-slate-400 border-slate-700";
                  if (status === "حضور") statusBg = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
                  else if (status === "تأخير") statusBg = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                  else if (status === "غائب") statusBg = "bg-rose-500/20 text-rose-300 border-rose-500/40";

                  return (
                    <tr key={student.barcode} className="hover:bg-amber-500/5 transition-colors">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-amber-300">{student.barcode}</td>
                      <td className="p-3 font-bold text-slate-100">{student.name}</td>
                      <td className="p-3 text-slate-300">{student.groupGrade}</td>
                      <td className="p-3 text-slate-400">{student.groupDays}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-block ${statusBg}`}>
                          {status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{student.parentPhone}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingStudent({
                                barcode: student.barcode,
                                name: student.name,
                                currentStatus: status,
                              });
                              setNewStatusSelect(status === "لم يسجل" ? "حضور" : status);
                            }}
                            className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>

                          <button
                            onClick={() =>
                              openWhatsApp(
                                student.parentPhone,
                                `تنبيه من منظومة الأستاذة إيمان الدمشيتي 📐\nنفيدكم بأن حالة الطالب/ة (${student.name}) بتاريخ ${selectedDate} هي: (${status}).`
                              )
                            }
                            className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold"
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

      {/* Edit Status Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121926] border border-amber-500/40 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-extrabold text-amber-400 border-b border-amber-500/20 pb-2">
              🔄 تعديل حالة حضور الطالب
            </h3>
            <div className="text-xs space-y-2 text-slate-300">
              <p>
                اسم الطالب: <span className="font-bold text-white">{editingStudent.name}</span>
              </p>
              <p>
                التاريخ: <span className="font-mono text-amber-300">{selectedDate}</span>
              </p>
            </div>

            <form onSubmit={handleSaveStatus} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">اختر الحالة الجديدة:</label>
                <select
                  value={newStatusSelect}
                  onChange={(e) => setNewStatusSelect(e.target.value)}
                  className="w-full bg-[#090e17] border border-amber-500/40 text-slate-100 px-3 py-2.5 rounded-xl font-bold text-sm outline-none"
                >
                  <option value="حضور">🟢 حضور (في الموعد)</option>
                  <option value="تأخير">🟡 تأخير</option>
                  <option value="غائب">🔴 غائب</option>
                  <option value="إذن">⚪ إذن مسبق / عذر</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-md"
                >
                  تحديث وحفظ الحالة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
