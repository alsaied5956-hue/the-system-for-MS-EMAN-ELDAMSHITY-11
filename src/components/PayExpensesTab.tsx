import React, { useState } from "react";
import { Student, GradeName, PaymentRecord } from "../types";
import { getCurrentMonthKey, getTodayKey, openWhatsApp, DEFAULT_GRADE_PRICES } from "../utils/helpers";
import { enqueuePendingWhatsAppMessage } from "../utils/storage";
import { playBeep } from "../utils/audio";
import { StudentSearchBox } from "./StudentSearchBox";
import { StudentFinancialLedgerModal } from "./StudentFinancialLedgerModal";
import { CreditCard, CheckCircle, Tag, Sparkles, Send, ScanLine, Clock, FileText } from "lucide-react";

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
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);

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

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    // Enqueue message into persistent WhatsApp queue
    enqueuePendingWhatsAppMessage({
      studentBarcode: selectedStudent.barcode,
      studentName: selectedStudent.name,
      grade: selectedStudent.groupGrade,
      phone: selectedStudent.parentPhone,
      messageType: "مصاريف",
      message: receiptMsg,
    });

    if (isOnline) {
      openWhatsApp(selectedStudent.parentPhone, receiptMsg);
      alert(`✅ تم إثبات سداد ${amount} ج.م للطالب (${selectedStudent.name}) وإرسال إيصال الواتساب بنجاح!`);
    } else {
      alert(
        `⚡ أنت في وضع الأوفلاين (بدون إنترنت):\nتم إثبات سداد ${amount} ج.م للطالب (${selectedStudent.name}) وحفظ إيصال الواتساب في "طابور رسائل الواتساب المعلقة".\nيمكنك إرسال كافة الإيصالات بضغطة واحدة فور عودة الإنترنت!`
      );
    }

    setSearchInput("");
    setSelectedStudent(null);
    setCustomAmount("");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-2xl space-y-6">
        <div className="flex items-center gap-3.5 pb-4 border-b border-indigo-500/20">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-400/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-fancy text-amber-300">
              نافذة إثبات وسداد المصروفات والاشتراكات
            </h2>
            <p className="text-xs text-slate-400 font-tajawal mt-0.5">
              بحث ذكي بالاسم (مثال: أحمد علي) أو ضرب الباركود بالسكانر مع إرسال إيصال فوري لواتساب ولي الأمر
            </p>
          </div>
        </div>

        <form onSubmit={handlePaySubmit} className="space-y-4 text-xs font-bold font-tajawal">
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
            <div className="glass-card border-emerald-500/40 p-5 rounded-2xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-emerald-300 font-fancy">{selectedStudent.name}</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    {selectedStudent.groupGrade} • {selectedStudent.groupDays} • باركود #{selectedStudent.barcode}
                  </p>
                </div>
                <div className="text-left">
                  <span className="text-[11px] text-slate-400 block">الاشتراك المستحق:</span>
                  <span className="text-lg font-black text-amber-300 font-mono">
                    {selectedStudent.customMonthlyFee ??
                      groupPrices[selectedStudent.groupGrade] ??
                      100}{" "}
                    <span className="text-xs font-tajawal font-normal text-slate-400">ج.م</span>
                  </span>
                </div>
              </div>

              {selectedStudent.customMonthlyFee !== undefined && (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>طالب باشتراك خاص مخصص ({selectedStudent.customMonthlyFee} ج.م)</span>
                </div>
              )}

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsLedgerModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>عرض كشف الحساب الشامل للطالب 📊</span>
                </button>
              </div>
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
                className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-100 p-3 rounded-2xl outline-none focus:border-amber-400 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300">المبلغ المدفوع (ج.م):</label>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="المبلغ المسدد..."
                className="w-full bg-[#080d1e] border border-indigo-500/30 text-amber-300 font-mono text-base p-3 rounded-2xl outline-none focus:border-amber-400 font-bold transition-all"
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
              className="w-full bg-[#080d1e] border border-indigo-500/30 text-slate-100 p-3 rounded-2xl outline-none focus:border-amber-400 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedStudent}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 hover:from-amber-300 hover:to-yellow-100 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            <CheckCircle className="w-5 h-5 text-slate-950" />
            <span>إثبات السداد وإرسال الإيصال عبر الواتساب</span>
          </button>
        </form>
      </div>

      {/* Student Detailed Financial Ledger Modal */}
      {selectedStudent && (
        <StudentFinancialLedgerModal
          student={selectedStudent}
          payments={payments}
          groupPrices={groupPrices}
          isOpen={isLedgerModalOpen}
          onClose={() => setIsLedgerModalOpen(false)}
          onRecordQuickPayment={onRecordPayment}
        />
      )}
    </div>
  );
};
