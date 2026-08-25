import React from "react";
import { UserAccount } from "../types";
import { TEACHER_NAME, PREDEFINED_SESSION_SLOTS } from "../utils/helpers";
import {
  Shield,
  User,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Clock,
  Wifi,
  WifiOff,
  LogOut,
  Menu,
  Printer,
} from "lucide-react";

interface NavbarProps {
  currentUser: UserAccount | null;
  currentDateText?: string;
  isOnline?: boolean;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  onLogout: () => void;
  activeSessionSlotId?: string;
  onChangeSessionSlot?: (slotId: string) => void;
  onOpenQuickScan?: () => void;
  onOpenPrintAllPDF?: () => void;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentDateText = "",
  isOnline = false,
  theme = "dark",
  onToggleTheme,
  voiceEnabled = true,
  onToggleVoice,
  onLogout,
  activeSessionSlotId = "auto",
  onChangeSessionSlot,
  onOpenPrintAllPDF,
  onToggleSidebar,
}) => {
  return (
    <header className="no-print bg-[#121926]/90 backdrop-blur-md border-b border-amber-500/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-lg">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl bg-slate-800/80 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            title="القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 flex items-center justify-center shadow-md shadow-amber-500/20 text-black font-black text-xl">
          إ
        </div>
        <div>
          <h1 className="font-extrabold text-base md:text-lg text-amber-400 leading-tight">
            منظومة {TEACHER_NAME}
          </h1>
          <p className="text-[11px] md:text-xs text-slate-400 font-medium">أستاذة الرياضيات | 01070642904</p>
        </div>
      </div>

      {/* Session Time Slot Selector */}
      {onChangeSessionSlot && (
        <div className="flex items-center gap-2 bg-[#090e17] border border-amber-500/30 px-3 py-1.5 rounded-xl shadow-inner">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <label className="text-xs font-bold text-amber-300/90 whitespace-nowrap hidden sm:inline">
            موعد الحصة والتأخير:
          </label>
          <select
            value={activeSessionSlotId}
            onChange={(e) => onChangeSessionSlot(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-100 outline-none cursor-pointer"
          >
            {PREDEFINED_SESSION_SLOTS.map((slot) => (
              <option key={slot.id} value={slot.id} className="bg-slate-900 text-white font-medium">
                {slot.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Controls & User Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Quick Print PDF Button */}
        {onOpenPrintAllPDF && (
          <button
            onClick={onOpenPrintAllPDF}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all shadow-sm"
            title="طباعة وتصدير تقارير PDF مقسمة للصفوف"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة PDF</span>
          </button>
        )}

        {/* Date Display */}
        {currentDateText && (
          <span className="hidden xl:inline-block text-xs font-semibold text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            📅 {currentDateText}
          </span>
        )}

        {/* Online / Offline status */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
            isOnline
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`}
          title={isOnline ? "متصل سحابياً فورياً" : "غير متصل - حفظ محلي"}
        >
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isOnline ? "سحابي متزامن" : "حفظ محلي"}</span>
        </div>

        {/* Voice Announcement Toggle */}
        {onToggleVoice && (
          <button
            onClick={onToggleVoice}
            className={`p-2 rounded-xl border transition-all ${
              voiceEnabled
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm"
                : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
            title={voiceEnabled ? "النطق الصوتي للأسماء مفعل" : "النطق الصوتي معطل"}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}

        {/* Theme Toggle */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-amber-400 transition-all"
            title={theme === "dark" ? "التبديل للوضع الفاتح" : "التبديل للوضع المظلم"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        {/* Current User Pill */}
        {currentUser && (
          <div className="flex items-center gap-2 bg-slate-800/90 border border-amber-500/30 px-2.5 py-1.5 rounded-xl">
            {currentUser.role === "admin" ? (
              <Shield className="w-4 h-4 text-amber-400" />
            ) : (
              <User className="w-4 h-4 text-cyan-400" />
            )}
            <span className="text-xs font-bold text-slate-200">
              {currentUser.username}
            </span>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all"
          title="تسجيل الخروج"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
