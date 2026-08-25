import * as XLSX from "xlsx";
import { Student, GradeName, GroupDays } from "../types";
import { getAttendanceRate, getAbsenceRate, getExamAverage, getTodayKey } from "./helpers";

export function exportStudentsToExcel(students: Student[], fileName = `قائمة_الطلاب_${getTodayKey()}`): void {
  const rows = students.map((s, index) => ({
    "م": index + 1,
    "كود الباركود": s.barcode,
    "اسم الطالب": s.name,
    "الصف الدراسي": s.groupGrade,
    "أيام المجموعة": s.groupDays,
    "رقم تليفون الطالب": s.phone,
    "رقم ولي الأمر": s.parentPhone,
    "الاشتراك الشهري (ج.م)": s.customMonthlyFee ?? "السعر الافتراضي",
    "سبب الخصم / الملاحظات": s.discountReason || "-",
    "إجمالي النقاط ⭐": s.points || 0,
    "نسبة الحضور": `${getAttendanceRate(s)}%`,
    "نسبة الغياب": `${getAbsenceRate(s)}%`,
    "متوسط درجات الامتحانات": `${getExamAverage(s)}%`,
    "آخر امتحان مسجل": s.lastExamTitle ? `${s.lastExamTitle} (${s.lastExamScore})` : "لا يوجد",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  
  // RTL setting for Arabic sheet
  worksheet["!views"] = [{ RTL: true }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب");

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportAllExamsToExcel(students: Student[], fileName = `سجل_الدرجات_التراكمي_${getTodayKey()}`): void {
  const rows = students.map((s, index) => ({
    "م": index + 1,
    "كود الباركود": s.barcode,
    "اسم الطالب": s.name,
    "الصف الدراسي": s.groupGrade,
    "أيام المجموعة": s.groupDays,
    "آخر امتحان": s.lastExamTitle || "لا يوجد",
    "النتيجة / الدرجة": s.lastExamScore || "لا يوجد",
    "متوسط كافة الامتحانات": `${getExamAverage(s)}%`,
    "عدد الامتحانات المؤداة": s.totalExamScores?.length || 0,
    "النقاط ⭐": s.points || 0,
    "رقم ولي الأمر": s.parentPhone,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!views"] = [{ RTL: true }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "الدرجات");

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportAttendanceHistoryToExcel(
  students: Student[],
  attendanceMap: Record<string, string>,
  selectedDate: string,
  fileName = `سجل_حضور_${selectedDate}`
): void {
  const rows = students.map((s, index) => ({
    "م": index + 1,
    "كود الباركود": s.barcode,
    "اسم الطالب": s.name,
    "الصف الدراسي": s.groupGrade,
    "أيام المجموعة": s.groupDays,
    [`الحالة بتاريخ ${selectedDate}`]: attendanceMap[s.barcode] || "لم يسجل",
    "رقم ولي الأمر": s.parentPhone,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!views"] = [{ RTL: true }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "الحضور والغياب");

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function parseStudentsFromExcelFile(file: File): Promise<{ students: Partial<Student>[]; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        const parsedStudents: Partial<Student>[] = [];
        const errors: string[] = [];

        jsonData.forEach((row, idx) => {
          // Flexible header mapping (Arabic or English)
          const barcode = String(row["كود الباركود"] || row["الباركود"] || row["Barcode"] || row["كود"] || row["ID"] || "").trim();
          const name = String(row["اسم الطالب"] || row["الاسم"] || row["Name"] || row["Student Name"] || "").trim();
          const phone = String(row["رقم تليفون الطالب"] || row["تليفون الطالب"] || row["Phone"] || row["موبايل"] || "").trim();
          const parentPhone = String(row["رقم ولي الأمر"] || row["تليفون ولي الأمر"] || row["Parent Phone"] || row["ولي الأمر"] || "").trim();
          const groupGrade = String(row["الصف الدراسي"] || row["الصف"] || row["المرحلة"] || row["Grade"] || "الصف الرابع الابتدائي").trim() as GradeName;
          const groupDays = String(row["أيام المجموعة"] || row["الأيام"] || row["المجموعة"] || row["Days"] || "سبت - إثنين - أربعاء").trim() as GroupDays;
          
          const rawFee = row["الاشتراك الشهري"] || row["السعر"] || row["المبلغ"] || row["Fee"];
          const customMonthlyFee = rawFee !== undefined && rawFee !== "" && !isNaN(Number(rawFee)) ? Number(rawFee) : undefined;
          const discountReason = String(row["سبب الخصم"] || row["الملاحظات"] || row["Notes"] || "").trim();

          if (!barcode || !name) {
            errors.push(`السطر ${idx + 2}: مفقود الباركود أو اسم الطالب.`);
            return;
          }

          parsedStudents.push({
            barcode,
            name,
            phone: phone || parentPhone,
            parentPhone: parentPhone || phone,
            groupGrade: groupGrade || "الصف الرابع الابتدائي",
            groupDays: groupDays || "سبت - إثنين - أربعاء",
            customMonthlyFee,
            discountReason: discountReason || undefined,
            points: 0,
            totalAttendanceDays: 0,
            totalAbsentDays: 0,
            totalExamScores: [],
          });
        });

        resolve({ students: parsedStudents, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
