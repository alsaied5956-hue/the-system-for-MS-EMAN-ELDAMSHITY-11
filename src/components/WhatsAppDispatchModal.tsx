import React, { useState, useEffect, useRef, useCallback } from "react";
import { Student, GradeName, GroupDays, WhatsAppMessageType } from "../types";
import { openWhatsApp, cleanPhoneNumber } from "../utils/helpers";
import { markWhatsAppMessageSentByBarcodeAndType } from "../utils/storage";
import { playBeep } from "../utils/audio";
import confetti from "canvas-confetti";
import {
  Send,
  CheckCircle2,
  Clock,
  UserX,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Copy,
  ExternalLink,
  Sparkles,
  Phone,
  MessageSquare,
  X,
  Keyboard,
  ShieldCheck,
  Zap,
  RefreshCw,
} from "lucide-react";

export interface DispatchItem {
  student: Student;
  message: string;
  type: "غائب" | "تأخير" | "عكس_أيام";
  status: "pending" | "sent" | "skipped";
  sentAt?: string;
}

interface WhatsAppDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  grade: GradeName;
  days: GroupDays;
  initialItems: {
    student: Student;
    message: string;
    type: "غائب" | "تأخير" | "عكس_أيام";
  }[];
}

export const WhatsAppDispatchModal: React.FC<WhatsAppDispatchModalProps> = ({
  isOpen,
  onClose,
  grade,
  days,
  initialItems,
}) => {
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isAutoSending, setIsAutoSending] = useState<boolean>(false);
  const [autoTimerCountdown, setAutoTimerCountdown] = useState<number>(2.5);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "absent" | "late" | "cross_days">("all");
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Initialize Queue when modal opens or items change
  useEffect(() => {
    if (isOpen && initialItems.length > 0) {
      setItems(
        initialItems.map((item) => ({
          ...item,
          status: "pending",
        }))
      );
      setCurrentIndex(0);
      setIsAutoSending(false);
      setAutoTimerCountdown(2.5);
      setIsCompleted(false);
    }
  }, [isOpen, initialItems]);

  const activeItem = items[currentIndex];

  // Send single student WhatsApp & advance
  const handleSendCurrent = useCallback(() => {
    if (!activeItem || activeItem.status === "sent") return;

    // 1. Open WhatsApp
    openWhatsApp(activeItem.student.parentPhone, activeItem.message);
    playBeep("success");

    // 2. Mark as sent in storage queue so it won't appear in pending outbox
    const msgType: WhatsAppMessageType =
      activeItem.type === "غائب" ? "غياب" : activeItem.type === "تأخير" ? "تأخير" : "عكس_أيام";
    markWhatsAppMessageSentByBarcodeAndType(activeItem.student.barcode, msgType);

    // 3. Mark as sent locally
    const updated = [...items];
    updated[currentIndex] = {
      ...updated[currentIndex],
      status: "sent",
      sentAt: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };
    setItems(updated);

    // 4. Find next pending index
    const nextPendingIdx = updated.findIndex((it, idx) => idx > currentIndex && it.status === "pending");

    if (nextPendingIdx !== -1) {
      setCurrentIndex(nextPendingIdx);
      setAutoTimerCountdown(2.5);
    } else {
      // Check if any pending remain anywhere in array
      const anyPendingIdx = updated.findIndex((it) => it.status === "pending");
      if (anyPendingIdx !== -1) {
        setCurrentIndex(anyPendingIdx);
        setAutoTimerCountdown(2.5);
      } else {
        // All completed!
        setIsCompleted(true);
        setIsAutoSending(false);
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {
          // ignore
        }
      }
    }
  }, [activeItem, currentIndex, items]);

  // Skip current student
  const handleSkipCurrent = () => {
    if (!activeItem) return;
    const updated = [...items];
    updated[currentIndex] = {
      ...updated[currentIndex],
      status: "skipped",
    };
    setItems(updated);

    const nextPendingIdx = updated.findIndex((it, idx) => idx > currentIndex && it.status === "pending");
    if (nextPendingIdx !== -1) {
      setCurrentIndex(nextPendingIdx);
      setAutoTimerCountdown(2.5);
    } else {
      const anyPendingIdx = updated.findIndex((it) => it.status === "pending");
      if (anyPendingIdx !== -1) {
        setCurrentIndex(anyPendingIdx);
      } else {
        setIsCompleted(true);
        setIsAutoSending(false);
      }
    }
  };

  // Keyboard shortcut listener (Enter = Send & Next, Space = Toggle Auto, Esc = Close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a textarea or input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
        if (e.key === "Enter" && e.ctrlKey) {
          e.preventDefault();
          handleSendCurrent();
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        handleSendCurrent();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsAutoSending((prev) => !prev);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleSendCurrent, onClose]);

  // Auto-send Interval Mechanism
  useEffect(() => {
    if (!isAutoSending || isCompleted || !isOpen) return;

    const interval = setInterval(() => {
      setAutoTimerCountdown((prev) => {
        if (prev <= 0.2) {
          handleSendCurrent();
          return 2.5;
        }
        return Math.max(0, Number((prev - 0.2).toFixed(1)));
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isAutoSending, isCompleted, isOpen, handleSendCurrent]);

  const handleCopyMessage = (msg: string, id: string) => {
    navigator.clipboard.writeText(msg);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpdateMessageText = (newText: string) => {
    if (!activeItem) return;
    const updated = [...items];
    updated[currentIndex] = {
      ...updated[currentIndex],
      message: newText,
    };
    setItems(updated);
  };

  const handleResetQueue = () => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        status: "pending",
      }))
    );
    setCurrentIndex(0);
    setIsCompleted(false);
    setIsAutoSending(false);
  };

  const totalCount = items.length;
  const sentCount = items.filter((it) => it.status === "sent").length;
  const skippedCount = items.filter((it) => it.status === "skipped").length;
  const pendingCount = items.filter((it) => it.status === "pending").length;
  const progressPercent = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;

  const filteredItems = items.filter((it) => {
    if (activeFilter === "absent") return it.type === "غائب";
    if (activeFilter === "late") return it.type === "تأخير";
    if (activeFilter === "cross_days") return it.type === "عكس_أيام";
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 overflow-y-auto">
      <div className="bg-[#0c121e] border-2 border-amber-500/40 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Luxury Gold/Emerald Header */}
        <div className="bg-gradient-to-r from-[#121b2b] via-[#0d1624] to-[#121b2b] border-b border-amber-500/30 p-4 md:p-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white font-black text-lg">
              💬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-amber-300">
                  طابور إرسال إشعارات الواتساب التتابعي الفوري
                </h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                  {totalCount} طالب في الطابور
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {grade} • {days}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
              <Keyboard className="w-3.5 h-3.5 text-amber-400" />
              <span>اضغط <strong className="text-amber-300 font-mono">Enter ↵</strong> للإرسال والتالي</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar & Summary Stats */}
        <div className="bg-[#070b13] px-4 md:px-6 py-3 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <div className="flex items-center gap-3">
              <span className="text-slate-300">
                نسبة الإنجاز: <span className="text-emerald-400 font-mono font-black">{progressPercent}%</span>
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> تم إرسال: {sentCount}
              </span>
              <span className="text-amber-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> متبقي: {pendingCount}
              </span>
              {skippedCount > 0 && (
                <span className="text-slate-400 flex items-center gap-1">
                  <SkipForward className="w-3.5 h-3.5" /> تم التخطي: {skippedCount}
                </span>
              )}
            </div>

            <div className="font-mono text-xs text-amber-400">
              {totalCount > 0 ? `الطالب (${Math.min(currentIndex + 1, totalCount)} من ${totalCount})` : ""}
            </div>
          </div>

          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6">
          {isCompleted ? (
            /* Completion Card */
            <div className="text-center py-8 px-4 bg-gradient-to-b from-[#121c2e] to-[#0a101b] rounded-3xl border-2 border-emerald-500/40 space-y-4 shadow-xl animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-3xl border border-emerald-500/40 shadow-lg shadow-emerald-500/20">
                🎉
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white">
                تم الانتهاء من إرسال جميع إشعارات الحصة بنجاح!
              </h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                تمت معالجة كافة أولياء أمور الغائبين والمتأخرين لـ ({grade}). كافة السجلات الآن محفوظة وموثقة بالمنظومة.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleResetQueue}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة فتح الطابور للإرسال مجدداً</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>إغلاق والعودة للقاعة</span>
                </button>
              </div>
            </div>
          ) : activeItem ? (
            /* Active Student Spotlight Card */
            <div className="bg-gradient-to-br from-[#111928] via-[#0d1422] to-[#0a0f1a] border-2 border-amber-400/50 rounded-3xl p-4 md:p-6 shadow-2xl relative overflow-hidden">
              
              {/* Background ambient glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative space-y-4">
                {/* Student Info Top Row */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-amber-500/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-black flex items-center gap-1.5 shadow-md ${
                          activeItem.type === "غائب"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            : activeItem.type === "تأخير"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        }`}
                      >
                        {activeItem.type === "غائب" ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : activeItem.type === "تأخير" ? (
                          <Clock className="w-3.5 h-3.5" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                        <span>
                          {activeItem.type === "غائب"
                            ? "🔴 إشعار غياب اليوم"
                            : activeItem.type === "تأخير"
                            ? "🟡 إشعار تأخير عن الحصة"
                            : "🔄 إشعار حضور في مجموعة عكس الأيام"}
                        </span>
                      </span>

                      <span className="font-mono text-xs text-amber-300 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800">
                        #{activeItem.student.barcode}
                      </span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-black text-white tracking-wide pt-1">
                      {activeItem.student.name}
                    </h3>
                    <p className="text-xs text-slate-300 flex items-center gap-2">
                      <span>{activeItem.student.groupGrade}</span>
                      <span>•</span>
                      <span>{activeItem.student.groupDays}</span>
                    </p>
                  </div>

                  {/* Phone & Direct Info */}
                  <div className="text-left bg-slate-900/90 border border-slate-800 p-3 rounded-2xl space-y-1">
                    <div className="text-[11px] text-slate-400 font-bold flex items-center gap-1 justify-end">
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <span>رقم ولي الأمر:</span>
                    </div>
                    <div className="font-mono font-bold text-base md:text-lg text-emerald-400" dir="ltr">
                      {activeItem.student.parentPhone || "غير مسجل"}
                    </div>
                  </div>
                </div>

                {/* Editable WhatsApp Message Preview */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-amber-300 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" />
                      <span>نص الرسالة المجهز للواتساب:</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleCopyMessage(activeItem.message, activeItem.student.barcode)}
                      className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedId === activeItem.student.barcode ? "تم النسخ! ✓" : "نسخ النص"}</span>
                    </button>
                  </div>

                  <textarea
                    value={activeItem.message}
                    onChange={(e) => handleUpdateMessageText(e.target.value)}
                    rows={3}
                    className="w-full bg-[#080d17] border border-amber-500/30 text-slate-100 text-xs md:text-sm p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-amber-400/40 transition-all font-medium leading-relaxed resize-none shadow-inner"
                    placeholder="اكتب نص الرسالة هنا..."
                  />
                </div>

                {/* Primary Action Buttons Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Send & Next Primary Button */}
                    <button
                      type="button"
                      onClick={handleSendCurrent}
                      className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer border border-emerald-400/30"
                    >
                      <Send className="w-4 h-4" />
                      <span>إرسال وفتح الواتساب (Enter ↵)</span>
                    </button>

                    {/* Skip Button */}
                    <button
                      type="button"
                      onClick={handleSkipCurrent}
                      className="px-4 py-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <SkipForward className="w-4 h-4" />
                      <span>تخطي</span>
                    </button>
                  </div>

                  {/* Auto-Dispatch Sequential Stepper Toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAutoSending(!isAutoSending)}
                      className={`px-4 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-lg cursor-pointer border ${
                        isAutoSending
                          ? "bg-amber-500 text-black border-amber-300 shadow-amber-500/30 animate-pulse"
                          : "bg-slate-900 text-amber-400 border-amber-500/30 hover:bg-slate-800"
                      }`}
                    >
                      {isAutoSending ? (
                        <>
                          <Pause className="w-4 h-4" />
                          <span>إيقاف الإرسال التلقائي ({autoTimerCountdown}ث)</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span>تشغيل الإرسال التلقائي (كل 2.5 ثانية)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ) : null}

          {/* All Queue Table / Review List */}
          <div className="bg-[#090e18] border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <h4 className="font-extrabold text-xs text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>قائمة جميع الطلاب بالطابور ({items.length})</span>
              </h4>

              {/* Filter pills */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                    activeFilter === "all" ? "bg-amber-500 text-black" : "text-slate-400 hover:text-white"
                  }`}
                >
                  الكل ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("absent")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                    activeFilter === "absent" ? "bg-rose-500 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  الغياب ({items.filter((i) => i.type === "غائب").length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("late")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                    activeFilter === "late" ? "bg-amber-500 text-black" : "text-slate-400 hover:text-white"
                  }`}
                >
                  التأخير ({items.filter((i) => i.type === "تأخير").length})
                </button>
                {items.some((i) => i.type === "عكس_أيام") && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter("cross_days")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                      activeFilter === "cross_days" ? "bg-cyan-500 text-black" : "text-cyan-400 hover:text-white"
                    }`}
                  >
                    عكس الأيام ({items.filter((i) => i.type === "عكس_أيام").length})
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/80 pr-1">
              {filteredItems.map((item, idx) => {
                const originalIndex = items.findIndex((it) => it.student.barcode === item.student.barcode);
                const isSelected = originalIndex === currentIndex;

                return (
                  <div
                    key={item.student.barcode + idx}
                    className={`py-2.5 px-3 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? "bg-amber-500/10 border border-amber-500/40"
                        : "hover:bg-slate-900/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentIndex(originalIndex);
                          setIsCompleted(false);
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 transition-transform ${
                          item.status === "sent"
                            ? "bg-emerald-500 text-white"
                            : item.status === "skipped"
                            ? "bg-slate-700 text-slate-300"
                            : isSelected
                            ? "bg-amber-500 text-black scale-110"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {item.status === "sent" ? "✓" : originalIndex + 1}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white truncate">
                            {item.student.name}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                              item.type === "غائب"
                                ? "bg-rose-500/20 text-rose-300"
                                : item.type === "تأخير"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-cyan-500/20 text-cyan-300"
                            }`}
                          >
                            {item.type === "عكس_أيام" ? "🔄 عكس الأيام" : item.type}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400" dir="ltr">
                          {item.student.parentPhone || "لا يوجد رقم"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          item.status === "sent"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : item.status === "skipped"
                            ? "bg-slate-800 text-slate-400"
                            : "bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {item.status === "sent"
                          ? `✅ تم (${item.sentAt || "الآن"})`
                          : item.status === "skipped"
                          ? "⏭️ تم التخطي"
                          : "⏳ بالانتظار"}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          openWhatsApp(item.student.parentPhone, item.message);
                          const msgType: WhatsAppMessageType =
                            item.type === "غائب" ? "غياب" : item.type === "تأخير" ? "تأخير" : "عكس_أيام";
                          markWhatsAppMessageSentByBarcodeAndType(item.student.barcode, msgType);
                          const up = [...items];
                          up[originalIndex] = {
                            ...up[originalIndex],
                            status: "sent",
                            sentAt: new Date().toLocaleTimeString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                          };
                          setItems(up);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold transition-all flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>فتح الآن</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-[#0d1422] p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            💡 نصيحة: بمجرد الضغط على <strong className="text-amber-300">Enter ↵</strong> سيتم فتح محادثة الواتساب للرقم الحالي وتجهيز الرقم التالي مباشرة بدون توقف!
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
