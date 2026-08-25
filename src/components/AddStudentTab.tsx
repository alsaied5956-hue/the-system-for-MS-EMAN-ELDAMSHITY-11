import React, { useState } from "react";
import { Student, GradeName, GroupDays, GRADE_ORDER } from "../types";
import { openWhatsApp, DEFAULT_GRADE_PRICES } from "../utils/helpers";
import { UserPlus, Sparkles, Tag } from "lucide-react";

interface AddStudentTabProps {
  students: Student[];
  groupPrices: Record<GradeName, number>;
  onAddStudent: (student: Student, cardFee: number) => void;
}

export const AddStudentTab: React.FC<AddStudentTabProps> = ({
  students,
  groupPrices,
  onAddStudent,
}) => {
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [groupGrade, setGroupGrade] = useState<GradeName>("الصف الرابع الابتدائي");
  const [groupDays, setGroupDays] = useState<GroupDays>("سبت - إثنين - أربعاء");
  const [isCustomFee, setIsCustomFee] = useState(false);
  const [customMonthlyFee, setCustomMonthlyFee] = useState<number>(100);
  const [discountReason, setDiscountReason] = useState("");
  const [cardFeeAmount, setCardFeeAmount] = useState(30);

  const defaultGradePrice = groupPrices[groupGrade] ?? DEFAULT_GRADE_PRICES[groupGrade] ?? 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBarcode = barcode.trim();
    const cleanName = name.trim();

    if (!cleanBarcode || !cleanName) {
      alert("⚠️ يرجى إدخال كود الباركود واسم الطالب ثلاثي!");
      return;
    }

    if (students.some((s) => String(s.barcode).trim() === cleanBarcode)) {
      alert("⚠️ هذا الباركود مسجل لطالب آخر بالفعل! يرجى استخدام كود مختلف.");
      return;
    }

    const newStudent: Student = {
      barcode: cleanBarcode,
      name: cleanName,
      phone: phone.trim() || parentPhone.trim(),
      parentPhone: parentPhone.trim() || phone.trim(),
      groupGrade,
      groupDays,
      customMonthlyFee: isCustomFee ? customMonthlyFee : undefined,
      discountReason: isCustomFee ? discountReason.trim() : undefined,
      points: 0,
      totalAttendanceDays: 0,
      totalAbsentDays: 0,
      totalExamScores: [],
      createdAt: new Date().toISOString(),
    };

    onAddStudent(newStudent, cardFeeAmount);

    // Send WhatsApp Welcome & Card Fee receipt
    const welcomeMsg = `تم تسجيل الطالب/ة: (${cleanName})\nمع ميس إيمان الدمشيتي - أستاذة الرياضيات 📐\nالصف: ${groupGrade} (${groupDays})\nقيمة استخراج الكارت: ${cardFeeAmount} ج.م\nالاشتراك الشهري: ${
      isCustomFee ? customMonthlyFee : defaultGradePrice
    } ج.م\nنرحب بكم ونتمنى لأبنائنا دوام التوفيق والتميز 🌟`;

    openWhatsApp(parentPhone || phone, welcomeMsg);

    // Reset Form
    setBarcode("");
    setName("");
    setPhone("");
    setParentPhone("");
    setIsCustomFee(false);
    setDiscountReason("");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-[#121926]/90 border border-amber-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3 pb-4 border-b border-amber-500/20 mb-5">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-400">
              تسجيل طالب جديد وتحديد الاشتراك الشهري
            </h2>
            <p className="text-xs text-slate-400">
              تسجيل بيانات الطالب مع إمكانية تحديد اشتراك شهري مخصص (50، 60، 70، 80 ج.م أو حسب رغبتك)
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
          <div className="space-y-1.5">
            <label className="text-slate-300">الرقم التسلسلي لكارت الباركود (Barcode) *</label>
            <input
              type="text"
              required
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="مرر الكارت أمام الإسكانر أو اكتب الكود..."
              className="w-full bg-[#090e17] border border-amber-500/30 focus:border-amber-400 text-slate-100 px-3.5 py-2.5 rounded-xl outline-none font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300">اسم الطالب ثلاثي *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أحمد محمد علي"
              className="w-full bg-[#090e17] border border-amber-500/30 focus:border-amber-400 text-slate-100 px-3.5 py-2.5 rounded-xl outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300">رقم تليفون الطالب</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full bg-[#090e17] border border-amber-500/30 focus:border-amber-400 text-slate-100 px-3.5 py-2.5 rounded-xl outline-none font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300">رقم تليفون ولي الأمر (للواتساب) *</label>
              <input
                type="text"
                required
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full bg-[#090e17] border border-amber-500/30 focus:border-amber-400 text-slate-100 px-3.5 py-2.5 rounded-xl outline-none font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300">الصف الدراسي *</label>
              <select
                value={groupGrade}
                onChange={(e) => setGroupGrade(e.target.value as GradeName)}
                className="w-full bg-[#090e17] border border-amber-500/30 focus:border-amber-400 text-slate-100 px-3.5 py-2.5 rounded-xl outline-none text-sm cursor-pointer"
              >
                {GRADE_ORDER.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300">أيام المجموعة *</label>
              <select
                value={groupDays}
                onChange={(e) => setGroupDays(e.target.value as GroupDays)}
                className="w-full bg-[#090e17] border border-amber-500/30 focus:border-amber-400 text-slate-100 px-3.5 py-2.5 rounded-xl outline-none text-sm cursor-pointer"
              >
                <option value="سبت - إثنين - أربعاء">سبت - إثنين - أربعاء</option>
                <option value="أحد - ثلاثاء - خميس">أحد - ثلاثاء - خميس</option>
              </select>
            </div>
          </div>

          {/* Custom Monthly Fee Section (As requested by user) */}
          <div className="bg-[#090e17] border border-amber-500/30 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-amber-300 flex items-center gap-1.5 font-extrabold text-xs">
                <Tag className="w-4 h-4 text-amber-400" />
                تحديد اشتراك شهري مخصص للطالب:
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCustomFee}
                  onChange={(e) => {
                    setIsCustomFee(e.target.value === "true" || e.target.checked);
                    if (!isCustomFee) setCustomMonthlyFee(defaultGradePrice);
                  }}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <span className="text-xs text-slate-300 font-bold">تفعيل سعر مخصص</span>
              </label>
            </div>

            {isCustomFee ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-slate-300 text-[11px]">قيمة الاشتراك الشهري (ج.م):</label>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={customMonthlyFee}
                    onChange={(e) => setCustomMonthlyFee(Number(e.target.value))}
                    placeholder="مثلاً: 50 أو 60 أو 70 أو 80"
                    className="w-full bg-[#121926] border border-amber-400 text-amber-300 px-3 py-2 rounded-lg outline-none font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 text-[11px]">سبب الخصم / الملاحظة:</label>
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="مثال: خصم إخوة / أيتام / تفوق"
                    className="w-full bg-[#121926] border border-slate-700 text-slate-200 px-3 py-2 rounded-lg outline-none text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">
                السعر الافتراضي للمرحلة:{" "}
                <span className="text-emerald-400 font-bold">{defaultGradePrice} ج.م شهرياً</span>
              </div>
            )}
          </div>

          {/* Card Fee */}
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-300 text-xs">رسوم استخراج كارت الباركود:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={cardFeeAmount}
                onChange={(e) => setCardFeeAmount(Number(e.target.value))}
                className="w-20 bg-[#090e17] border border-slate-700 text-center text-amber-300 font-bold text-xs py-1 rounded"
              />
              <span className="text-slate-400 text-xs">ج.م (تسجل كإيراد فوري)</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-200 text-black font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-98"
          >
            <Sparkles className="w-4 h-4" />
            <span>حفظ وتأكيد تسجيل الطالب وفتح واتساب ولي الأمر 📲</span>
          </button>
        </form>
      </div>
    </div>
  );
};
