import React, { useState } from "react";
import { Student, GradeName, PaymentRecord } from "../types";
import { getCurrentMonthKey, getTodayKey, openWhatsApp, DEFAULT_GRADE_PRICES } from "../utils/helpers";
import { playBeep } from "../utils/audio";
import { StudentSearchBox } from "./StudentSearchBox";
import { CreditCard, CheckCircle, Tag, Sparkles, Send, ScanLine } from "lucide-react";

interface PayExpensesTabProps {
  students: Student[];
  groupPrices: Record<GradeName, number>;
  payments: Record<string, Record<string, PaymentRecord>>;
  onRecordPayment: (barcode: string, amount: number, monthKey: string, note: string) => void;
}

export const PayExpensesTab: React.FC<PayExpensesTabProps> = ({
  students,
  groupPrices,
  payments,
  onRecordPayment,
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [customAmount, setCustomAmount] = useState<number | "">("");
  const [paymentNote, setPaymentNote] = useState("سداد الاشتراك الشهري");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSearchInput(student.name);
    const defaultPrice =
      student.customMonthlyFee ??
      groupPrices[student.groupGrade] ??
      DEFAULT_GRADE_PRICES[student.groupGrade] ??
      150;
    setCustomAmount(defaultPrice);
    playBeep("success");
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert("⚠️ يرجى اختيار أو مسح باركود طالب مسجل أولاً!");
      return;
    }

    const amount = Number(customAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("⚠️ يرجى إدخال مبلغ صحيح!");
      return;
    }

    onRecordPayment(
      selectedStudent.barcode,
      amount,
      selectedMonth,
      paymentNote.trim() || `اشتراك شهر ${selectedMonth}`
    );

    playBeep("success");

    // WhatsApp Receipt
    const receiptMsg = `إيصال سداد اشتراك 🧾\nمنظومة الأستاذة إيمان الدمشيتي - رياضيات 📐\nاسم الطالب: ${selectedStudent.name}\nالصف: ${selectedStudent.groupGrade}\nعن شهر: ${selectedMonth}\nالمبلغ المسدد: ${amount} ج.م\nالتاريخ: ${getTodayKey()}\nشاكرين لكم حسن تعاونكم واهتمامكم ✨`;

    openWhatsApp(selectedStudent.parentPhone, receiptMsg);

    alert(`✅ تم إثبات سداد ${amount} ج.م للطالب (${selectedStudent.name}) بنجاح!`);

    setSearchInput("");
    setSelectedStudent(null);
    setCustomAmount("");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-[#121926]/90 border border-amber-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3 pb-4 border-b border-amber-500/20 mb-5">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-400">
              نافذة إثبات وسداد المصروفات والاشتراكات
            </h2>
            <p className="text-xs text-slate-400">
              بحث ذكي بالاسم (مثال: أحمد علي) أو ضرب الباركود بالسكانر مع إرسال إيصال فوري لواتساب ولي الأمر
            </p>
          </div>
        </div>

        <form onSubmit={handlePaySubmit} className="space-y-4 text-xs font-bold">
          {/* Smart Search / Barcode Input */}
          <div className="space-y-1.5">
            <label className="text-slate-300 flex items-center justify-between">
              <span>ابحث باسم الطالب أو مرر الكارت بالسكانر:</span>
              <span className="text-[11px] text-amber-400 font-normal">
                يدعم البحث بالاسم الأول والأخير وتجاوز الأسماء الوسطى
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

          {/* Student Found Info Card */}
          {selectedStudent && (
            <div className="bg-[#090e17] border border-emerald-500/40 p-4 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-emerald-400">{selectedStudent.name}</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedStudent.groupGrade} • {selectedStudent.groupDays} • باركود #{selectedStudent.barcode}
                  </p>
                </div>
                <div className="text-left">
                  <span className="text-[11px] text-slate-400 block">الاشتراك المستحق:</span>
                  <span className="text-base font-black text-amber-300">
                    {selectedStudent.customMonthlyFee ??
                      groupPrices[selectedStudent.groupGrade] ??
                      100}{" "}
                    ج.م
                  </span>
                </div>
              </div>

              {selectedStudent.customMonthlyFee !== undefined && (
                <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-lg">
                  <Tag className="w-3.5 h-3.5 text-purple-400" />
                  <span>طالب باشتراك خاص مخصص ({selectedStudent.customMonthlyFee} ج.م)</span>
                </div>
              )}
            </div>
          )}

          {/* Month selection & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300">شهر الاشتراك:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 p-2.5 rounded-xl outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300">المبلغ المدفوع (ج.م):</label>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="المبلغ المسدد..."
                className="w-full bg-[#090e17] border border-amber-500/30 text-amber-300 font-mono text-base p-2.5 rounded-xl outline-none focus:border-amber-400 font-bold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300">ملاحظات الإيصال:</label>
            <input
              type="text"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="مثال: سداد كامل / دفعة أولى"
              className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 p-2.5 rounded-xl outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedStudent}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-black font-black text-sm hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            <span>إثبات السداد وإرسال الإيصال عبر الواتساب</span>
          </button>
        </form>
      </div>
    </div>
  );
};
