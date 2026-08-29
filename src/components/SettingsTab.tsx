import React, { useState, useEffect } from "react";
import { UserAccount, GradeName, GRADE_ORDER } from "../types";
import { DEFAULT_GRADE_PRICES, getWhatsAppMode, setWhatsAppMode } from "../utils/helpers";
import { KeyRound, Tag, ShieldCheck, CheckCircle, MessageSquare, Globe, Smartphone, Sun, Moon, Palette, ExternalLink, Sparkles } from "lucide-react";

interface SettingsTabProps {
  currentUser: UserAccount;
  groupPrices: Record<GradeName, number>;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onChangePassword: (newPass: string) => void;
  onUpdateGroupPrice: (grade: GradeName, newPrice: number) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  groupPrices,
  theme = "dark",
  onToggleTheme,
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
      {/* Theme Settings Card (Dark / Light Mode) */}
      <div className="bg-[#121926]/90 border border-amber-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-amber-500/20">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-400">
              مظهر المنظومة (الوضع المظلم / الوضع الفاتح)
            </h2>
            <p className="text-xs text-slate-400">
              اختر المظهر المريح لعينيك أثناء العمل والمتابعة
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Dark Mode Card */}
          <button
            type="button"
            onClick={() => {
              if (theme !== "dark" && onToggleTheme) onToggleTheme();
            }}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
              theme === "dark"
                ? "bg-slate-900 border-amber-400 shadow-md ring-2 ring-amber-400/40"
                : "bg-slate-800/40 border-slate-700 opacity-70 hover:opacity-100 hover:border-slate-500"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-slate-950 text-amber-400">
                  <Moon className="w-5 h-5" />
                </div>
                <span className="font-black text-sm text-slate-100">الوضع المظلم (Dark)</span>
              </div>
              {theme === "dark" && (
                <span className="text-[10px] bg-amber-500 text-black font-black px-2 py-0.5 rounded-full">
                  المفعل حالياً
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              مظهر ليلي كلاسيكي فاخر بألوان كحلية وذهبية مريحة للعين.
            </p>
          </button>

          {/* Light Mode Card */}
          <button
            type="button"
            onClick={() => {
              if (theme !== "light" && onToggleTheme) onToggleTheme();
            }}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
              theme === "light"
                ? "bg-amber-50 border-amber-500 shadow-md ring-2 ring-amber-500/40 text-slate-900"
                : "bg-slate-800/40 border-slate-700 opacity-70 hover:opacity-100 hover:border-slate-500"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500 text-slate-900">
                  <Sun className="w-5 h-5" />
                </div>
                <span className="font-black text-sm text-slate-900 dark:text-slate-100">الوضع الفاتح (Light)</span>
              </div>
              {theme === "light" && (
                <span className="text-[10px] bg-amber-500 text-black font-black px-2 py-0.5 rounded-full">
                  المفعل حالياً
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              مظهر نهاري ناصع وفائق الوضوح ومثالي للقاعات والطباعة.
            </p>
          </button>
        </div>
      </div>

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
              placeholder="أدخل كلمة المرور الحالية"
              className="w-full bg-[#090e17] border border-slate-700 text-slate-100 px-3.5 py-2 rounded-xl outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-300">كلمة المرور الجديدة *</label>
            <input
              type="password"
              required
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="أدخل كلمة المرور الجديدة"
              className="w-full bg-[#090e17] border border-slate-700 text-slate-100 px-3.5 py-2 rounded-xl outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-300">تأكيد كلمة المرور الجديدة *</label>
            <input
              type="password"
              required
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="أعد إدخال كلمة المرور الجديدة"
              className="w-full bg-[#090e17] border border-slate-700 text-slate-100 px-3.5 py-2 rounded-xl outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-xs shadow-md hover:from-amber-400 transition-all"
          >
            تحديث كلمة المرور 🔒
          </button>
        </form>
      </div>

      {/* WhatsApp Sending Engine Target */}
      <div className="bg-[#121926]/90 border border-amber-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-amber-500/20">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-emerald-400">
              طريقة فتح وإرسال رسائل WhatsApp
            </h2>
            <p className="text-xs text-slate-400">
              اختر بين فتح WhatsApp Web على المتصفح أو فتح تطبيق الواتساب المثبت
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Mode Web */}
          <button
            type="button"
            onClick={() => handleWhatsAppModeChange("web")}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
              waMode === "web"
                ? "bg-emerald-500/20 border-emerald-400 shadow-md ring-2 ring-emerald-400/30"
                : "bg-slate-800/40 border-slate-700 hover:border-slate-500"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="font-black text-sm text-slate-100">WhatsApp Web (الموصى به)</span>
              </div>
              {waMode === "web" && (
                <span className="text-[10px] bg-emerald-500 text-black font-black px-2 py-0.5 rounded-full">
                  المفعل حالياً
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              يفتح متصفح Google Chrome تلقائياً في نافذة جديدة مع نص الرسالة ورقم ولي الأمر جاهزاً للإرسال.
            </p>
          </button>

          {/* Mode App */}
          <button
            type="button"
            onClick={() => handleWhatsAppModeChange("app")}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
              waMode === "app"
                ? "bg-emerald-500/20 border-emerald-400 shadow-md ring-2 ring-emerald-400/30"
                : "bg-slate-800/40 border-slate-700 hover:border-slate-500"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <span className="font-black text-sm text-slate-100">تطبيق WhatsApp</span>
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

      {/* External System Link Card */}
      <div className="bg-gradient-to-r from-[#0d1627] via-[#101b30] to-[#0d1627] border border-amber-500/40 p-6 rounded-2xl shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500/30 to-amber-600/20 text-amber-400 border border-amber-500/40 rounded-xl shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-300">
                منظومة الأستاذة إيمان الدمشيتي (الرابط الخارجي)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                الانتقال المباشر للمنظومة الخارجية بضغطة زر واحدة
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <a
            href="https://the-system-for-ms-eman-eldamshity-p.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-sm shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-0.5 cursor-pointer no-underline"
          >
            <ExternalLink className="w-5 h-5 text-black stroke-[2.5]" />
            <span className="text-sm font-black tracking-wide">
              فتح منظومة الأستاذة إيمان الدمشيتي 🚀
            </span>
          </a>
        </div>
      </div>
    </div>
  );
};
