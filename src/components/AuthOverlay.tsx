import React, { useState } from "react";
import { UserAccount } from "../types";
import { TEACHER_NAME } from "../utils/helpers";
import { Lock, Shield, KeyRound, ArrowRight } from "lucide-react";

interface AuthOverlayProps {
  usersList: UserAccount[];
  onLoginSuccess: (user: UserAccount) => void;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({
  usersList,
  onLoginSuccess,
}) => {
  const [selectedUsername, setSelectedUsername] = useState(
    usersList[0]?.username || "admin"
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const targetUser = usersList.find((u) => u.username === selectedUsername);
    if (!targetUser) {
      setErrorMsg("❌ المستخدم غير موجود!");
      return;
    }

    if (targetUser.pass !== passwordInput.trim()) {
      setErrorMsg("❌ كلمة المرور غير صحيحة! يرجى إعادة المحاولة.");
      return;
    }

    onLoginSuccess(targetUser);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070a11] flex items-center justify-center p-4">
      {/* Background Glows */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-[#121926]/95 border border-amber-500/30 p-8 rounded-3xl shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Logo / Badge */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 flex items-center justify-center text-black font-black text-3xl shadow-xl shadow-amber-500/20">
            إ
          </div>
          <h1 className="text-2xl font-black text-amber-400">
            منظومة {TEACHER_NAME}
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            منظومة إدارة دروس الرياضيات الذكية والسريعة
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/40 text-rose-300 rounded-xl text-center">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-slate-300">اختر المستخدم / الحساب:</label>
            <div className="relative">
              <select
                value={selectedUsername}
                onChange={(e) => setSelectedUsername(e.target.value)}
                className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 px-4 py-3 rounded-xl outline-none font-bold text-sm cursor-pointer"
              >
                {usersList.map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.username} ({u.role === "admin" ? "👑 المسؤول الكامل" : "👤 سكرتارية"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300">كلمة المرور (Password):</label>
            <div className="relative">
              <input
                type="password"
                required
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="أدخل كلمة المرور..."
                className="w-full bg-[#090e17] border border-amber-500/30 focus:border-amber-400 text-slate-100 px-4 py-3 rounded-xl outline-none font-mono text-sm pr-10"
              />
              <KeyRound className="w-4 h-4 text-amber-400/50 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 text-black font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-98"
          >
            <span>تسجيل الدخول للمنظومة</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800/80">
          <p className="text-[11px] text-slate-500">
            حساب الأدمن الافتراضي: <span className="text-amber-400 font-mono">admin</span> /{" "}
            <span className="text-amber-400 font-mono">2468</span>
          </p>
        </div>
      </div>
    </div>
  );
};
