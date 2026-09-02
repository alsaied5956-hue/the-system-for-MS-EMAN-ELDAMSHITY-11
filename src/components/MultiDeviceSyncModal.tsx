import React, { useState, useRef } from "react";
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Laptop,
  Users,
  CreditCard,
  FileJson,
  UploadCloud,
  DownloadCloud,
  RefreshCw,
  X,
  ShieldCheck,
  Sparkles,
  ArrowRightLeft,
  Info
} from "lucide-react";
import {
  syncAndMergeAllDevicesData,
  exportCompleteBackupJSON,
  importAndMergeCompleteBackupJSON,
  loadLocalData
} from "../utils/storage";
import { Student, PaymentRecord } from "../types";

interface MultiDeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  payments: Record<string, Record<string, PaymentRecord>>;
  isOnline: boolean;
}

export const MultiDeviceSyncModal: React.FC<MultiDeviceSyncModalProps> = ({
  isOpen,
  onClose,
  students,
  payments,
  isOnline,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Calculate local counts
  const totalLocalStudents = students.length;
  let totalLocalPayments = 0;
  const totalMonths = Object.keys(payments || {}).length;
  Object.values(payments || {}).forEach((m) => {
    totalLocalPayments += Object.keys(m || {}).length;
  });

  // Action 1: Push & Merge with Cloud
  const handlePushAndMerge = async () => {
    setLoadingAction("push");
    setFeedback(null);
    try {
      const result = await syncAndMergeAllDevicesData("push_and_merge");
      if (result.success) {
        setFeedback({
          type: "success",
          title: "🎉 تم توحيد ورفع بيانات الأجهزة بنجاح!",
          message: result.message,
          details: `بيانات هذا الجهاز قبل التوحيد: ${result.localStudentsBefore} طالب | السحابة: ${result.cloudStudentsBefore} طالب | الإجمالي الموحد النهائي: ${result.unifiedStudentsCount} طالب.`,
        });
      } else {
        setFeedback({
          type: "error",
          title: "تعذر إتمام المزامنة",
          message: result.message,
        });
      }
    } catch (e: any) {
      setFeedback({
        type: "error",
        title: "خطأ غير متوقع",
        message: e?.message || "حدث خطأ أثناء المزامنة.",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Action 2: Pull & Merge latest from Cloud
  const handlePullLatest = async () => {
    setLoadingAction("pull");
    setFeedback(null);
    try {
      const result = await syncAndMergeAllDevicesData("pull_and_merge");
      if (result.success) {
        setFeedback({
          type: "success",
          title: "✅ تم سحب وتحديث كل البيانات من السحابة!",
          message: `تم تحديث هذا الجهاز بنجاح. يحتوي الآن على (${result.unifiedStudentsCount}) طالب و (${result.unifiedPaymentsCount}) اشتراك مدفوع.`,
        });
      } else {
        setFeedback({
          type: "error",
          title: "تعذر سحب البيانات",
          message: result.message,
        });
      }
    } catch (e: any) {
      setFeedback({
        type: "error",
        title: "خطأ في السحب",
        message: e?.message || "حدث خطأ أثناء جلب البيانات.",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Action 3: Export complete JSON backup
  const handleExportJSON = () => {
    try {
      exportCompleteBackupJSON();
      setFeedback({
        type: "info",
        title: "💾 تم تنزيل ملف النسخة الاحتياطية الشاملة!",
        message: "تم حفظ ملف النسخة الاحتياطية على جهازك. يمكنك الآن نقله (عبر واتساب أو فلاشة) واستيراده في أي جهاز آخر لدمج الطلاب مباشرة حتى بدون إنترنت.",
      });
    } catch (e: any) {
      setFeedback({
        type: "error",
        title: "فشل التصدير",
        message: e?.message || "تعذر تصدير الملف.",
      });
    }
  };

  // Action 4: Import JSON file from another device
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingAction("import_file");
    setFeedback(null);
    try {
      const result = await importAndMergeCompleteBackupJSON(file);
      if (result.success) {
        setFeedback({
          type: "success",
          title: "🎉 تم دمج ملف الجهاز الآخر بنجاح!",
          message: result.message,
          details: `تم دمج واستيراد (${result.importedStudentsCount}) طالب من الملف. الإجمالي الحالي أصبح (${result.totalStudentsAfter}) طالب و (${result.totalPaymentsAfter}) اشتراك.`,
        });
      } else {
        setFeedback({
          type: "error",
          title: "فشل استيراد الملف",
          message: result.message,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        title: "خطأ في الملف",
        message: err?.message || "ملف غير صالح.",
      });
    } finally {
      setLoadingAction(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-gradient-to-b from-slate-900 via-slate-900 to-[#0b1329] border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto text-slate-100 font-['Readex_Pro','Cairo',sans-serif]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-indigo-500/20 bg-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-white/20">
              <Cloud className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-amber-300 flex items-center gap-2">
                <span>مركز توحيد ومزامنة جميع الأجهزة</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  سحابي وفوري
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                حل مشكلة اختلاف الأسماء والبيانات بين الأجهزة لضمان تطابق كافة الأجهزة 100%
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          
          {/* Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">طلاب هذا الجهاز</p>
                <p className="text-lg font-black text-blue-300">{totalLocalStudents} <span className="text-xs font-normal">طالب</span></p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">الاشتراكات المدفوعة</p>
                <p className="text-lg font-black text-emerald-300">{totalLocalPayments} <span className="text-xs font-normal">إيصال</span></p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">شهور الاشتراكات</p>
                <p className="text-lg font-black text-purple-300">{totalMonths} <span className="text-xs font-normal">شهور</span></p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${isOnline ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"} border flex items-center justify-center shrink-0`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">حالة الاتصال السحابي</p>
                <p className={`text-sm font-black ${isOnline ? "text-emerald-400" : "text-amber-400"}`}>
                  {isOnline ? "متصل بالسحابة ✅" : "غير متصل ⚠️"}
                </p>
              </div>
            </div>
          </div>

          {/* Feedback message banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl border text-sm font-medium animate-fadeIn ${
                feedback.type === "success"
                  ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
                  : feedback.type === "error"
                  ? "bg-rose-950/80 border-rose-500/50 text-rose-200"
                  : "bg-blue-950/80 border-blue-500/50 text-blue-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                ) : feedback.type === "error" ? (
                  <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h4 className="font-black text-base">{feedback.title}</h4>
                  <p>{feedback.message}</p>
                  {feedback.details && (
                    <p className="text-xs opacity-90 pt-1 font-mono">{feedback.details}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step by Step Explanatory Guide Box */}
          <div className="p-4 md:p-5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-3">
            <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>كيف تجمع وتوحد بيانات جهازين أو أكثر؟ (حل مشكلة اختلاف الأسماء):</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-300 font-bold">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs">1</span>
                  <span>الجهاز الأول (مثلاً اللابتوب):</span>
                </div>
                <p className="text-slate-400">
                  اضغط زر <strong className="text-amber-300">«رفع وتوحيد كل بيانات هذا الجهاز»</strong> لرفع كل طلابه واشتراكاته للسحابة.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-300 font-bold">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs">2</span>
                  <span>الجهاز الثاني (أو الموبايل):</span>
                </div>
                <p className="text-slate-400">
                  افتح الجهاز الثاني واضغط أيضاً <strong className="text-amber-300">«رفع وتوحيد كل بيانات هذا الجهاز»</strong> (سيقوم بدمج طلابه مع طلاب الجهاز الأول معاً بالسحابة).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-300 font-bold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">3</span>
                  <span>النتيجة النهائية:</span>
                </div>
                <p className="text-slate-400">
                  اضغط زر <strong className="text-emerald-300">«سحب وتحديث البيانات»</strong> في كل الأجهزة، وستجد كل الأسماء والاشتراكات متطابقة 100% دون نقص!
                </p>
              </div>
            </div>
          </div>

          {/* Direct Cloud Action Buttons */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-300 flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-indigo-400" />
              <span>إجراءات المزامنة السحابية المباشرة:</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Button 1: Push & Merge */}
              <button
                onClick={handlePushAndMerge}
                disabled={loadingAction !== null}
                className="relative p-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white font-bold shadow-lg shadow-indigo-600/25 border border-indigo-400/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-col items-start gap-2 text-right disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5 text-base font-black">
                    {loadingAction === "push" ? (
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-300" />
                    ) : (
                      <CloudUpload className="w-5 h-5 text-amber-300" />
                    )}
                    <span>🚀 رفع وتوحيد كل بيانات هذا الجهاز مع السحابة</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-black/30 text-[10px] text-amber-300 font-mono">
                    Union Merge
                  </span>
                </div>
                <p className="text-xs text-indigo-100/90 leading-relaxed font-normal">
                  يجمع كل طلاب هذا الجهاز ({totalLocalStudents} طالب) مع الطلاب الموجودين في السحابة بدون مسح أي طالب، ويرفع النسخة الموحدة لجميع الأجهزة.
                </p>
              </button>

              {/* Button 2: Pull Latest */}
              <button
                onClick={handlePullLatest}
                disabled={loadingAction !== null}
                className="relative p-5 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-600 hover:to-teal-700 text-white font-bold shadow-lg shadow-emerald-700/25 border border-emerald-400/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-col items-start gap-2 text-right disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5 text-base font-black">
                    {loadingAction === "pull" ? (
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-300" />
                    ) : (
                      <CloudDownload className="w-5 h-5 text-amber-300" />
                    )}
                    <span>🔄 سحب وتحديث كل البيانات من السحابة</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-black/30 text-[10px] text-emerald-300 font-mono">
                    Pull & Refresh
                  </span>
                </div>
                <p className="text-xs text-emerald-100/90 leading-relaxed font-normal">
                  يقوم بتحميل وتطبيق أحدث قاعدة بيانات موحدة من السحابة على هذا الجهاز فوراً لجعل الأسماء والاشتراكات مطابقة لباقي الأجهزة.
                </p>
              </button>
            </div>
          </div>

          {/* Offline / Direct File Transfer Section */}
          <div className="p-4 md:p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <h3 className="text-sm font-black text-slate-300 flex items-center gap-2">
              <FileJson className="w-4 h-4 text-amber-400" />
              <span>طريقة بديلة بدون إنترنت (نقل ملف النسخة الاحتياطية مباشرة بين الأجهزة):</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Export JSON */}
              <button
                onClick={handleExportJSON}
                className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow"
              >
                <DownloadCloud className="w-4 h-4 text-amber-400" />
                <span>💾 تصدير ملف النسخة الاحتياطية الموحدة (.json)</span>
              </button>

              {/* Import JSON */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelected}
                  accept=".json"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loadingAction !== null}
                  className="w-full p-3.5 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow disabled:opacity-50"
                >
                  {loadingAction === "import_file" ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-300" />
                  ) : (
                    <UploadCloud className="w-4 h-4 text-purple-300" />
                  )}
                  <span>📥 استيراد ودمج ملف نسخة احتياطية من جهاز آخر</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <p className="text-[11px] text-slate-400">
            🔒 نظام الحماية السحابي يضمن عدم مسح أي طالب أو إيصال دفع أثناء عملية الدمج والتوحيد.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
