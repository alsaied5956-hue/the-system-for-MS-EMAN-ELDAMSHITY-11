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
  Sparkles,
  Layers,
  ChevronLeft,
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

interface NavItem {
  id: TabType;
  label: string;
  icon: any;
  show: boolean;
  badge?: string;
  alert?: boolean;
  gold?: boolean;
}

interface NavCategory {
  title: string;
  items: NavItem[];
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

  const categories: NavCategory[] = [
    {
      title: "العمليات والحضور اليومي",
      items: [
        { id: "attendance-scan" as TabType, label: "سكانر الحضور والتأخير", icon: ScanLine, show: true, badge: "مباشر" },
        { id: "add-student" as TabType, label: "إضافة طالب جديد ومجموعة", icon: UserPlus, show: hasPerm("add_student") },
        { id: "stats" as TabType, label: "تقرير الحضور اليومي والسابق", icon: CalendarCheck, show: true },
      ],
    },
    {
      title: "الدرجات والتقييم الأكاديمي",
      items: [
        { id: "cumulative-report" as TabType, label: "سجل الدرجات ونسب الطلاب", icon: FileSpreadsheet, show: true },
        { id: "grades" as TabType, label: "رصد درجات الامتحانات", icon: FileCheck2, show: hasPerm("add_grades") },
        { id: "early-warning" as TabType, label: "الإنذار المبكر للأداء والغياب", icon: AlertTriangle, show: hasPerm("early_warning"), alert: true },
        { id: "certificates" as TabType, label: "شهادات التفوق الأكاديمي", icon: Award, show: hasPerm("certificates"), gold: true },
      ],
    },
    {
      title: "المالية والمصروفات",
      items: [
        { id: "pay-expenses" as TabType, label: "دفع مصاريف واشتراكات الطلاب", icon: CreditCard, show: hasPerm("pay_expenses") },
        { id: "expenses" as TabType, label: "الإيرادات والإحصاء المالي", icon: Coins, show: hasPerm("view_revenues") },
      ],
    },
    {
      title: "التواصل والبيانات",
      items: [
        { id: "whatsapp-engine" as TabType, label: "المراسلة الفردية عبر واتساب", icon: MessageSquare, show: hasPerm("send_messages") },
        { id: "excel-integration" as TabType, label: "استيراد وتصدير شيتات Excel", icon: FileDown, show: hasPerm("excel_integration") },
      ],
    },
    {
      title: "لوحة التحكم والإدارة",
      items: [
        { id: "manage-students" as TabType, label: "إدارة وتعديل بيانات الطلاب", icon: Users2, show: isAdmin },
        { id: "users" as TabType, label: "حسابات المساعدين والصلاحيات", icon: FileSignature, show: isAdmin },
        { id: "settings" as TabType, label: "إعدادات الأسعار وكلمة المرور", icon: KeyRound, show: isAdmin },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Aside element */}
      <aside
        className={`no-print fixed md:sticky top-0 md:top-[65px] right-0 h-screen md:h-[calc(100vh-65px)] w-76 bg-[#080d1a] md:bg-[#080d1a]/95 backdrop-blur-2xl border-l border-amber-500/15 flex flex-col transition-all duration-300 z-50 md:z-20 shrink-0 shadow-2xl ${
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        }`}
      >
        {/* Mobile Header with Close button */}
        <div className="p-4 border-b border-amber-500/20 flex items-center justify-between md:hidden bg-slate-900/95">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
              إ
            </div>
            <span className="text-sm font-black text-amber-400">قائمة المنظومة 📐</span>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Quick Hub */}
        <div className="p-3.5 border-b border-amber-500/15 bg-gradient-to-b from-amber-500/10 via-[#0d162a]/40 to-transparent">
          <p className="text-[11px] font-black text-amber-300 mb-2 px-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>تصدير وطباعة PDF مقسم:</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">A4 جاهز</span>
          </p>
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <button
              onClick={() => onOpenPdfModal("attendance")}
              className="px-2.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[11px] font-black transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer transform active:scale-95"
            >
              <span>📄 تقرير الغياب</span>
            </button>
            <button
              onClick={() => onOpenPdfModal("exams")}
              className="px-2.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-300 text-[11px] font-black transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer transform active:scale-95"
            >
              <span>📊 سجل الدرجات</span>
            </button>
          </div>
          {onOpenPrintCards && (
            <button
              onClick={onOpenPrintCards}
              className="w-full px-2.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-[11px] font-black transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transform active:scale-95"
            >
              <span>🪪 طباعة كروت الباركود الذكية (ID Cards)</span>
            </button>
          )}
        </div>

        {/* Main Nav Items Categorized */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {categories.map((cat, idx) => {
            const visibleItems = cat.items.filter((it) => it.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-1">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2.5 mb-1">
                  {cat.title}
                </div>

                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectTab(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold text-right transition-all group cursor-pointer ${
                          isActive
                            ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 font-black transform scale-[1.02]"
                            : item.alert
                            ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25"
                            : item.gold
                            ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                              isActive
                                ? "text-slate-950"
                                : item.alert
                                ? "text-rose-400"
                                : item.gold
                                ? "text-amber-400"
                                : "text-slate-400 group-hover:text-amber-400"
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge && !isActive && (
                          <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                            {item.badge}
                          </span>
                        )}

                        {isActive && (
                          <ChevronLeft className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom System Info */}
        <div className="p-3 border-t border-amber-500/15 bg-[#060a14] text-center">
          <div className="text-[11px] font-black text-slate-300">
            منظومة إدارة الرياضيات الذكية
          </div>
          <div className="text-[10px] text-amber-500/80 font-mono font-bold mt-0.5">
            الأستاذة إيمان الدمشيتي • v3.5
          </div>
        </div>
      </aside>
    </>
  );
};
