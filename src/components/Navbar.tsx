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
  RefreshCw,
  LogOut,
  Menu,
  Printer,
  Sparkles,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";

interface NavbarProps {
  currentUser: UserAccount | null;
  currentDateText?: string;
  isOnline?: boolean;
  isSyncing?: boolean;
  hasPendingSync?: boolean;
  onManualSync?: () => void;
  pendingWhatsAppCount?: number;
  onOpenWhatsAppOutbox?: () => void;
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
  isOnline = true,
  isSyncing = false,
  hasPendingSync = false,
  onManualSync,
  pendingWhatsAppCount = 0,
  onOpenWhatsAppOutbox,
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
    <header className="no-print bg-[#0a101d]/90 backdrop-blur-2xl border-b border-amber-500/20 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3.5 sticky top-0 z-30 shadow-2xl transition-all">
      {/* Brand & Teacher Logo */}
      <div className="flex items-center gap-3.5">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-2xl bg-slate-800/90 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 active:scale-95 transition-all shadow-md cursor-pointer"
            title="القائمة الجانبية"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="relative group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 flex items-center justify-center shadow-lg shadow-amber-500/25 text-slate-950 font-black text-xl tracking-tighter border border-amber-300/40 transition-transform group-hover:scale-105">
            إ
          </div>
          <div className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full border-2 border-[#0a101d] flex items-center justify-center ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-black text-base md:text-lg text-white leading-tight tracking-tight flex items-center gap-1.5">
              <span>منظومة</span>
              <span className="gold-gradient-text font-black">{TEACHER_NAME}</span>
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-black text-amber-400">
              <Sparkles className="w-2.5 h-2.5" />
              <span>الرياضيات الذكية</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-2 mt-0.5">
            <span>أستاذة الرياضيات المتخصصة</span>
            <span className="text-slate-600 font-mono">•</span>
            <span className="font-mono text-slate-300">01070642904</span>
          </p>
        </div>
      </div>

      {/* Middle: Session Time Slot Selector */}
      {onChangeSessionSlot && (
        <div className="flex items-center gap-2 bg-[#070c17] border border-amber-500/30 px-3.5 py-2 rounded-2xl shadow-inner backdrop-blur-sm">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <label className="text-xs font-bold text-amber-300/90 whitespace-nowrap hidden lg:inline">
            موعد الحصة المعتمد:
          </label>
          <select
            value={activeSessionSlotId}
            onChange={(e) => onChangeSessionSlot(e.target.value)}
            className="bg-transparent text-xs font-black text-white outline-none cursor-pointer pr-1"
          >
            {PREDEFINED_SESSION_SLOTS.map((slot) => (
              <option key={slot.id} value={slot.id} className="bg-slate-900 text-white font-semibold">
                {slot.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Right Controls & Quick Utilities */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Print PDF Action */}
        {onOpenPrintAllPDF && (
          <button
            onClick={onOpenPrintAllPDF}
            className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-black transition-all shadow-sm transform hover:scale-[1.02] active:scale-95 cursor-pointer"
            title="طباعة وتصدير تقارير PDF مقسمة لكل صف"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>طباعة PDF مقسم</span>
          </button>
        )}

        {/* Date Tag */}
        {currentDateText && (
          <span className="hidden xl:inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 bg-slate-900/80 px-3 py-2 rounded-2xl border border-slate-800 shadow-sm">
            <span>📅</span>
            <span>{currentDateText}</span>
          </span>
        )}

        {/* Offline WhatsApp Outbox Queue Trigger */}
        {onOpenWhatsAppOutbox && (
          <button
            onClick={onOpenWhatsAppOutbox}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black border transition-all cursor-pointer transform active:scale-95 ${
              pendingWhatsAppCount > 0
                ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/20 animate-pulse hover:bg-emerald-500/30"
                : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700"
            }`}
            title={
              pendingWhatsAppCount > 0
                ? `توجد ${pendingWhatsAppCount} رسالة واتساب معلقة بانتظار الإرسال - اضغط لفتح الطابور وإرسالها`
                : "طابور رسائل الواتساب المعلقة (فارغ)"
            }
          >
            <MessageSquare className={`w-3.5 h-3.5 ${pendingWhatsAppCount > 0 ? "text-emerald-400" : "text-slate-400"}`} />
            <span className="hidden md:inline">
              {pendingWhatsAppCount > 0 ? "رسائل معلقة" : "طابور الواتساب"}
            </span>
            {pendingWhatsAppCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black font-mono">
                {pendingWhatsAppCount}
              </span>
            )}
          </button>
        )}

        {/* Live Cloud Status Indicator with Sync Button */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black border transition-all cursor-pointer transform active:scale-95 ${
              isSyncing
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse"
                : hasPendingSync
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/20 hover:bg-amber-500/30"
                : isOnline
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-sm shadow-emerald-500/10"
                : "bg-slate-800 text-amber-300 border-amber-500/30"
            }`}
            title={
              isSyncing
                ? "جارٍ مزامنة وتحديث البيانات مع السحابة..."
                : hasPendingSync
                ? "توجد بيانات مسجلة أوفلاين بانتظار المزامنة - اضغط للمزامنة فوراً"
                : isOnline
                ? "متصل سحابياً (أونلاين) - انقر للمزامنة الفورية الآن"
                : "وضع الأوفلاين - البيانات محفوظة محلياً وتتزامن فور توفر النت"
            }
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : hasPendingSync ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            ) : isOnline ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}

            <span className="hidden sm:inline font-mono">
              {isSyncing
                ? "جارٍ المزامنة..."
                : hasPendingSync
                ? "مزامنة المعلق"
                : isOnline
                ? "سحابي متزامن"
                : "وضع الأوفلاين"}
            </span>
          </button>
        </div>

        {/* Voice Announcement Audio Toggle */}
        {onToggleVoice && (
          <button
            onClick={onToggleVoice}
            className={`p-2.5 rounded-2xl border transition-all cursor-pointer transform active:scale-95 ${
              voiceEnabled
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/10"
                : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title={voiceEnabled ? "النطق الصوتي الترحيبي للطلاب مفعل" : "النطق الصوتي معطل"}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}

        {/* Theme Switcher (Dark / Light) */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/30 transition-all cursor-pointer transform active:scale-95 shadow-sm"
            title={theme === "dark" ? "التبديل إلى الوضع النهاري الفاتح" : "التبديل إلى الوضع المظلم الفاخر"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        )}

        {/* Current User Badge */}
        {currentUser && (
          <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/30 px-3 py-1.5 rounded-2xl shadow-sm">
            {currentUser.role === "admin" ? (
              <Shield className="w-4 h-4 text-amber-400" />
            ) : (
              <User className="w-4 h-4 text-cyan-400" />
            )}
            <span className="text-xs font-black text-slate-200">
              {currentUser.username}
            </span>
          </div>
        )}

        {/* Sign Out Button */}
        <button
          onClick={onLogout}
          className="p-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-all cursor-pointer transform active:scale-95 shadow-sm"
          title="تسجيل الخروج الآمن"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
