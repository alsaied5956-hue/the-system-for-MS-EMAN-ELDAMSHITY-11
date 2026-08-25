import React, { useState, useEffect } from "react";
import { UserAccount, GradeName, GRADE_ORDER } from "../types";
import { DEFAULT_GRADE_PRICES, getWhatsAppMode, setWhatsAppMode } from "../utils/helpers";
import { KeyRound, Tag, ShieldCheck, CheckCircle, MessageSquare, Globe, Smartphone } from "lucide-react";

interface SettingsTabProps {
  currentUser: UserAccount;
  groupPrices: Record<GradeName, number>;
  onChangePassword: (newPass: string) => void;
  onUpdateGroupPrice: (grade: GradeName, newPrice: number) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  groupPrices,
  onChangePassword,
  onUpdateGroupPrice,
}) => {
  // Password Change State
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  // WhatsApp Mode State
  const [waMode, setWaMode] = useState<"web" | "app">("web");

  useEffect(() => {
    setWaMode(getWhatsAppMode());
  }, []);

  const handleWhatsAppModeChange = (mode: "web" | "app") => {
    setWaMode(mode);
    setWhatsAppMode(mode);
  };

  // Group Price State
  const [selectedGrade, setSelectedGrade] = useState<GradeName>("الصف الرابع الابتدائي");
  const [priceInput, setPriceInput] = useState<number>(
    groupPrices["الصف الرابع الابتدائي"] ?? DEFAULT_GRADE_PRICES["الصف الرابع الابتدائي"] ?? 100
  );

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPass !== currentUser.pass) {
      alert("❌ كلمة المرور الحالية غير صحيحة!");
      return;
    }
    if (newPass !== confirmPass) {
      alert("⚠️ كلمة المرور الجديدة وتأكيدها غير متطابقين!");
      return;
    }
    if (!newPass.trim()) {
      alert("⚠️ لا يمكن ترك كلمة المرور فارغة!");
      return;
    }

    onChangePassword(newPass.trim());
    alert("✅ تم تغيير كلمة المرور بنجاح ومزامنتها سحابياً!");
    setCurrentPass("");
    setNewPass("");
    setConfirmPass("");
  };

  const handleGradeSelect = (grade: GradeName) => {
    setSelectedGrade(grade);
    setPriceInput(groupPrices[grade] ?? DEFAULT_GRADE_PRICES[grade] ?? 100);
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (priceInput <= 0) {
      alert("⚠️ يرجى إدخال سعر اشتراك صحيح!");
      return;
    }

    onUpdateGroupPrice(selectedGrade, priceInput);
    alert(`✅ تم تحديث سعر الاشتراك الافتراضي لـ (${selectedGrade}) بـ ${priceInput} ج.م بنجاح!`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Change Password Card */}
      <div className="bg-[#121926]/90 border border-amber-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-amber-500/20">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-400">
              تغيير كلمة مرور الحساب الحالي ({currentUser.username})
            </h2>
            <p className="text-xs text-slate-400">
              تحديث كلمة المرور مع الحفظ الفوري والتزامن السحابي
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs font-bold">
          <div className="space-y-1">
            <label className="text-slate-300">كلمة المرور الحالية *</label>
            <input
              type="password"
              required
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 px-3.5 py-2.5 rounded-xl outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300">كلمة المرور الجديدة *</label>
              <input
                type="password"
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 px-3.5 py-2.5 rounded-xl outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300">تأكيد كلمة المرور الجديدة *</label>
              <input
                type="password"
                required
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 px-3.5 py-2.5 rounded-xl outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black text-xs shadow-md hover:from-amber-400"
          >
            تحديث كلمة المرور 🔒
          </button>
        </form>
      </div>

      {/* WhatsApp Sending Mode Card */}
      <div className="bg-[#121926]/90 border border-emerald-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-emerald-500/20">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-emerald-400">
              طريقة فتح وإرسال رسائل الواتساب لأولياء الأمور
            </h2>
            <p className="text-xs text-slate-300">
              اختر ما إذا كنت تفضل فتح المحادثة عبر متصفح Google Chrome (واتساب ويب) أو عبر تطبيق الواتساب المكتبي
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <button
            type="button"
            onClick={() => handleWhatsAppModeChange("web")}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
              waMode === "web"
                ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/40"
                : "bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm text-white">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>واتساب ويب على جوجل كروم</span>
              </div>
              {waMode === "web" && (
                <span className="text-[10px] bg-emerald-500 text-black font-black px-2 py-0.5 rounded-full">
                  المفعل حالياً
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              يفتح صفحة الشات مباشرة داخل تبويب جديد في متصفح Google Chrome (<span className="font-mono text-emerald-400">web.whatsapp.com</span>) بدون تحويل لتطبيق خارجي.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleWhatsAppModeChange("app")}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
              waMode === "app"
                ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/40"
                : "bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm text-white">
                <Smartphone className="w-4 h-4 text-sky-400" />
                <span>تطبيق واتساب المثبت على الكمبيوتر</span>
              </div>
              {waMode === "app" && (
                <span className="text-[10px] bg-emerald-500 text-black font-black px-2 py-0.5 rounded-full">
                  المفعل حالياً
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              يقوم بفتح تطبيق WhatsApp المثبت على جهازك مباشرة (<span className="font-mono text-sky-400">wa.me</span>).
            </p>
          </button>
        </div>
      </div>

      {/* Default Grade Prices Card */}
      <div className="bg-[#121926]/90 border border-amber-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-amber-500/20">
          <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-400">
              تحديد أسعار الاشتراكات الشهرية الافتراضية لكل صف
            </h2>
            <p className="text-xs text-slate-400">
              هذه الأسعار تطبق تلقائياً عند إضافة طالب جديد مالم يتم تحديد سعر مخصص له
            </p>
          </div>
        </div>

        <form onSubmit={handleSavePrice} className="space-y-4 text-xs font-bold">
          <div className="space-y-1">
            <label className="text-slate-300">اختر الصف الدراسي:</label>
            <select
              value={selectedGrade}
              onChange={(e) => handleGradeSelect(e.target.value as GradeName)}
              className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 px-3.5 py-2.5 rounded-xl outline-none"
            >
              {GRADE_ORDER.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300">
              سعر الاشتراك الشهري الافتراضي للصف (بالجنيه المصري):
            </label>
            <input
              type="number"
              min={1}
              required
              value={priceInput}
              onChange={(e) => setPriceInput(Number(e.target.value))}
              className="w-full bg-[#090e17] border border-amber-400 text-amber-300 font-black px-3.5 py-2.5 rounded-xl text-lg outline-none"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-black font-black text-xs shadow-md hover:from-sky-400"
          >
            حفظ وتثبيت سعر الصف 💵
          </button>
        </form>
      </div>
    </div>
  );
};
