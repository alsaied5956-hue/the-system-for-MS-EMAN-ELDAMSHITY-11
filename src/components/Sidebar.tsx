import React from "react";
import { TabType, UserAccount, PermissionKey } from "../types";
import {
  ScanLine,
  UserPlus,
  CalendarCheck,
  Award,
  CreditCard,
  Coins,
  FileSpreadsheet,
  AlertTriangle,
  FileText,
  FileDown,
  MessageSquare,
  Users2,
  KeyRound,
  FileSignature,
  FileCheck2,
  X,
} from "lucide-react";

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  currentUser: UserAccount | null;
  isOpen: boolean;
  onCloseMobile: () => void;
  onOpenPdfModal: (type: "attendance" | "exams" | "all") => void;
  onOpenPrintCards?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  isOpen,
  onCloseMobile,
  onOpenPdfModal,
  onOpenPrintCards,
}) => {
  const hasPerm = (perm: PermissionKey): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    return currentUser.permissions?.includes(perm) ?? false;
  };

  const isAdmin = currentUser?.role === "admin";

  const navItems = [
    { id: "attendance-scan" as TabType, label: "📡 سكانر الحضور والتأخير", icon: ScanLine, show: true },
    { id: "add-student" as TabType, label: "➕ إضافة طالب ومجموعة", icon: UserPlus, show: hasPerm("add_student") },
    { id: "stats" as TabType, label: "📋 تقرير الحضور اليومي والسابقي", icon: CalendarCheck, show: true },
    { id: "cumulative-report" as TabType, label: "📊 سجل درجات ونسب الطلاب", icon: FileSpreadsheet, show: true },
    { id: "early-warning" as TabType, label: "🚨 نظام الإنذار المبكر للأداء والغياب", icon: AlertTriangle, show: hasPerm("early_warning"), highlight: true },
    { id: "certificates" as TabType, label: "📜 شهادات التقدير والتفوق الأكاديمي", icon: Award, show: hasPerm("certificates"), highlight: true },
    { id: "pay-expenses" as TabType, label: "💳 دفع مصاريف واشتراكات الطلاب", icon: CreditCard, show: hasPerm("pay_expenses") },
    { id: "expenses" as TabType, label: "💰 الإيرادات والإحصاء المالي", icon: Coins, show: hasPerm("view_revenues") },
    { id: "grades" as TabType, label: "📝 رصد درجات الامتحان الفورية", icon: FileCheck2, show: hasPerm("add_grades") },
    { id: "excel-integration" as TabType, label: "📥 استيراد وتصدير شيتات Excel", icon: FileDown, show: hasPerm("excel_integration") },
    { id: "whatsapp-engine" as TabType, label: "🚀 المراسلة الفردية المباشرة", icon: MessageSquare, show: hasPerm("send_messages") },
    { id: "manage-students" as TabType, label: "❌ لوحة التحكم وتعديل الطلاب", icon: Users2, show: isAdmin },
    { id: "users" as TabType, label: "👥 إدارة الحسابات والصلاحيات", icon: FileSignature, show: isAdmin },
    { id: "settings" as TabType, label: "🔑 إعدادات الأسعار وكلمة المرور", icon: KeyRound, show: isAdmin },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Aside element */}
      <aside
        className={`no-print fixed md:sticky top-0 md:top-[61px] right-0 h-screen md:h-[calc(100vh-61px)] w-72 bg-[#0d131f] md:bg-[#0d131f]/95 backdrop-blur-xl border-l border-amber-500/20 flex flex-col transition-transform duration-300 z-50 md:z-20 shrink-0 shadow-2xl ${
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        }`}
      >
        {/* Mobile Header with Close button */}
        <div className="p-3 border-b border-amber-500/20 flex items-center justify-between md:hidden bg-slate-900/90">
          <span className="text-xs font-black text-amber-400">قائمة المنظومة 📐</span>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable PDF Quick Export Section */}
        <div className="p-3 border-b border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-transparent">
          <p className="text-[11px] font-bold text-amber-300/80 mb-2 px-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            تصدير وطباعة PDF مقسم لكل صف:
          </p>
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <button
              onClick={() => onOpenPdfModal("attendance")}
              className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
            >
              <span>📄 تقرير الغياب</span>
            </button>
            <button
              onClick={() => onOpenPdfModal("exams")}
              className="px-2 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
            >
              <span>📊 سجل الدرجات</span>
            </button>
          </div>
          {onOpenPrintCards && (
            <button
              onClick={onOpenPrintCards}
              className="w-full px-2 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>🪪 طباعة كروت الباركود (ID Cards)</span>
            </button>
          )}
        </div>

        {/* Main Nav Items */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-right transition-all group ${
                    isActive
                      ? "bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-md shadow-amber-500/30 font-black scale-[1.01]"
                      : item.highlight
                      ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "text-slate-300 hover:bg-amber-500/10 hover:text-amber-300"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? "text-black" : item.highlight ? "text-rose-400" : "text-amber-400/80"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
        </nav>

        {/* Bottom Status */}
        <div className="p-3 border-t border-amber-500/10 bg-[#090e17]/80 text-center">
          <div className="text-[11px] font-semibold text-slate-400">
            منظومة إدارة الرياضيات الذكية
          </div>
          <div className="text-[10px] text-amber-500/70 font-mono mt-0.5">
            v3.0.0 • فائق السرعة والأمان
          </div>
        </div>
      </aside>
    </>
  );
};
