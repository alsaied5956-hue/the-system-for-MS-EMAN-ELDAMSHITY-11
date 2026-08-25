import React from "react";
import { Student, GradeName, GRADE_ORDER } from "../types";
import { TEACHER_NAME, getTodayKey, formatArabicDate, getAttendanceRate, getAbsenceRate, getExamAverage } from "../utils/helpers";
import { printElement, downloadPrintableHtml } from "../utils/print";
import { Printer, X, FileText, CheckCircle2, Download, Info } from "lucide-react";

interface PrintPDFModalProps {
  type: "attendance" | "exams" | "all";
  students: Student[];
  attendanceToday: Record<string, string>;
  onClose: () => void;
}

export const PrintPDFModal: React.FC<PrintPDFModalProps> = ({
  type,
  students,
  attendanceToday,
  onClose,
}) => {
  const todayKey = getTodayKey();
  const formattedDate = formatArabicDate(todayKey);

  const reportTitle =
    type === "attendance"
      ? `كشف_حضور_وغياب_${todayKey}`
      : type === "exams"
      ? `سجل_الدرجات_التراكمي_${todayKey}`
      : `التقرير_الشامل_${todayKey}`;

  const handlePrint = () => {
    printElement("printable-report-document", {
      title: `${reportTitle} - منظومة ${TEACHER_NAME}`,
      orientation: "portrait",
    });
  };

  const handleDownloadHtml = () => {
    downloadPrintableHtml(
      "printable-report-document",
      `${reportTitle}.html`,
      {
        title: `${reportTitle} - منظومة ${TEACHER_NAME}`,
        orientation: "portrait",
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center p-4 overflow-y-auto">
      {/* Top Controls Bar (Hidden during actual print) */}
      <div className="no-print bg-[#121926] border border-amber-500/30 w-full max-w-5xl p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 mb-6 shadow-2xl sticky top-4 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-amber-400">
              معاينة وتصدير ملفات PDF (كل مرحلة في صفحة مستقلة)
            </h3>
            <p className="text-xs text-slate-300">
              يفتح نافذة الطباعة مباشرة في تبويب جديد بجوجل كروم لطباعة أو حفظ PDF
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-black text-xs shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة وتصدير PDF الآن (Ctrl + P)</span>
          </button>

          <button
            onClick={handleDownloadHtml}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="تحميل التقرير كملف للفتح والطباعة من كروم في أي وقت"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>تحميل كملف مستند HTML</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="إغلاق المعاينة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tip for Saving PDF */}
        <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 flex items-center gap-2 text-xs text-amber-300">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>💡 للحفظ كملف PDF:</strong> عند الضغط على زر الطباعة، ستفتح صفحة التقرير في تبويب كروم وتظهر نافذة الطباعة تلقائياً، اختر خيار <strong>«Save as PDF / حفظ بتنسيق PDF»</strong>.
          </span>
        </div>
      </div>

      {/* Printable Multi-Page Document Container */}
      <div
        id="printable-report-document"
        className="w-full max-w-5xl space-y-8 bg-white text-slate-900 p-8 md:p-12 rounded-2xl shadow-2xl print:p-0 print:m-0 print:shadow-none print:w-full font-['Tajawal',sans-serif]"
      >
        {GRADE_ORDER.map((grade) => {
          const gradeStudents = students.filter((s) => s.groupGrade === grade);
          if (gradeStudents.length === 0) return null;

          return (
            <section
              key={grade}
              className="page-break-grade border-b-4 border-dashed border-slate-300 print:border-none pb-8 print:pb-0 mb-8 print:mb-0"
              style={{ pageBreakAfter: "always", breakAfter: "page" }}
            >
              {/* Grade Page Header */}
              <div className="flex items-center justify-between border-b-2 border-[#b38728] pb-4 mb-4">
                <div className="text-right">
                  <h1 className="text-2xl font-black text-[#8c671b] leading-tight">
                    منظومة {TEACHER_NAME}
                  </h1>
                  <p className="text-xs text-slate-600 font-bold">
                    أستاذة الرياضيات | هاتف: 01070642904
                  </p>
                </div>

                <div className="text-center">
                  <span className="text-lg font-black bg-amber-100 text-[#7c5b16] px-4 py-1.5 rounded-full border border-amber-300 inline-block shadow-sm">
                    {grade}
                  </span>
                  <p className="text-[11px] text-slate-500 font-bold mt-1">
                    {type === "attendance"
                      ? "كشف الحضور والغياب اليومي"
                      : "سجل الدرجات والنتائج التراكمية"}
                  </p>
                </div>

                <div className="text-left text-xs font-semibold text-slate-600">
                  <p>تاريخ التقرير:</p>
                  <p className="font-bold text-slate-900">{formattedDate}</p>
                </div>
              </div>

              {/* Summary Stats for Grade */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-bold mb-4">
                <span>إجمالي طلاب المرحلة: {gradeStudents.length} طالب</span>
                <span>
                  متوسط الحضور العام:{" "}
                  {Math.round(
                    gradeStudents.reduce((acc, s) => acc + getAttendanceRate(s), 0) /
                      gradeStudents.length
                  )}
                  %
                </span>
                <span>
                  متوسط درجات المرحلة:{" "}
                  {Math.round(
                    gradeStudents.reduce((acc, s) => acc + getExamAverage(s), 0) /
                      gradeStudents.length
                  )}
                  %
                </span>
              </div>

              {/* Table for Grade */}
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-[#7c5b16] font-black border-b border-slate-300">
                      <th className="p-2 border border-slate-300">م</th>
                      <th className="p-2 border border-slate-300">الباركود</th>
                      <th className="p-2 border border-slate-300">اسم الطالب ثلاثي</th>
                      <th className="p-2 border border-slate-300">المجموعة</th>
                      {type === "attendance" ? (
                        <>
                          <th className="p-2 border border-slate-300">حالة اليوم</th>
                          <th className="p-2 border border-slate-300">نسبة الحضور</th>
                          <th className="p-2 border border-slate-300">نسبة الغياب</th>
                        </>
                      ) : (
                        <>
                          <th className="p-2 border border-slate-300">آخر امتحان ودرجته</th>
                          <th className="p-2 border border-slate-300">متوسط الامتحانات</th>
                          <th className="p-2 border border-slate-300">النقاط ⭐</th>
                        </>
                      )}
                      <th className="p-2 border border-slate-300">الاشتراك المحدد</th>
                      <th className="p-2 border border-slate-300">رقم ولي الأمر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {gradeStudents.map((student, idx) => {
                      const status = attendanceToday[student.barcode] || "غائب";
                      const attRate = getAttendanceRate(student);
                      const absRate = getAbsenceRate(student);
                      const examAvg = getExamAverage(student);

                      return (
                        <tr
                          key={student.barcode}
                          className="hover:bg-amber-50/50 transition-colors page-break-avoid"
                        >
                          <td className="p-2 border border-slate-300 font-mono text-center">
                            {idx + 1}
                          </td>
                          <td className="p-2 border border-slate-300 font-mono font-bold">
                            {student.barcode}
                          </td>
                          <td className="p-2 border border-slate-300 font-bold text-slate-900">
                            {student.name}
                          </td>
                          <td className="p-2 border border-slate-300 text-slate-600 text-[11px]">
                            {student.groupDays}
                          </td>
                          {type === "attendance" ? (
                            <>
                              <td className="p-2 border border-slate-300 font-bold text-center">
                                <span
                                  className={
                                    status === "حضور"
                                      ? "text-emerald-700"
                                      : status === "تأخير"
                                      ? "text-amber-700"
                                      : "text-rose-700"
                                  }
                                >
                                  {status}
                                </span>
                              </td>
                              <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">
                                {attRate}%
                              </td>
                              <td className="p-2 border border-slate-300 text-center font-bold text-rose-700">
                                {absRate}%
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2 border border-slate-300 font-bold text-[#8c671b]">
                                {student.lastExamScore || "لا يوجد"}
                              </td>
                              <td className="p-2 border border-slate-300 text-center font-black">
                                {examAvg}%
                              </td>
                              <td className="p-2 border border-slate-300 text-center font-bold text-amber-700">
                                {student.points || 0} ⭐
                              </td>
                            </>
                          )}
                          <td className="p-2 border border-slate-300 text-center">
                            {student.customMonthlyFee !== undefined
                              ? `${student.customMonthlyFee} ج (مخصص)`
                              : "الافتراضي"}
                          </td>
                          <td className="p-2 border border-slate-300 font-mono text-center text-slate-700">
                            {student.parentPhone}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grade Page Footer */}
              <div className="flex items-center justify-between pt-6 mt-4 border-t border-slate-200 text-xs text-slate-600">
                <div>
                  <p>اعتماد وتوقيع أستاذة المادة:</p>
                  <p className="font-extrabold text-[#7c5b16] mt-1">{TEACHER_NAME}</p>
                </div>
                <div className="text-center font-mono text-[10px] text-slate-400">
                  صفحة مستقلة مخصصة لـ [{grade}]
                </div>
                <div className="text-left font-bold">
                  <span>ختم المنظومة</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
