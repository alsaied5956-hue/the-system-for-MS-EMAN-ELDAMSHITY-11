import React, { useState, useEffect, useMemo, useRef } from "react";
import { Student, GradeName, GRADE_ORDER, PendingWhatsAppMessage } from "../types";
import { TEACHER_NAME, cleanPhoneNumber } from "../utils/helpers";
import {
  generateGradeVCard,
  downloadVCardFile,
  generateWhatsAppGroupInvite,
  extractPhoneNumbersList,
  exportGradeContactsExcel,
} from "../utils/vcard";
import { enqueuePendingWhatsAppMessage } from "../utils/storage";
import QRCode from "qrcode";
import {
  MessageSquare,
  Users,
  Copy,
  Check,
  ExternalLink,
  Download,
  QrCode,
  Printer,
  Send,
  HelpCircle,
  FileSpreadsheet,
  PhoneCall,
  Sparkles,
  Info,
  Layers,
  Save,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

interface GradeWhatsAppGroupsHubProps {
  students: Student[];
  gradeWhatsAppLinks: Record<string, string>;
  onSaveGradeLink: (grade: string, link: string) => void;
  onOpenWhatsAppOutbox?: () => void;
  pendingWhatsAppCount?: number;
}

export const GradeWhatsAppGroupsHub: React.FC<GradeWhatsAppGroupsHubProps> = ({
  students,
  gradeWhatsAppLinks,
  onSaveGradeLink,
  onOpenWhatsAppOutbox,
  pendingWhatsAppCount = 0,
}) => {
  // Local edit state for links
  const [linksState, setLinksState] = useState<Record<string, string>>({});
  const [savedBadge, setSavedBadge] = useState<string | null>(null);
  const [copiedLinkGrade, setCopiedLinkGrade] = useState<string | null>(null);
  const [copiedPhoneGrade, setCopiedPhoneGrade] = useState<string | null>(null);
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  // QR & Poster Modal
  const [qrModalGrade, setQrModalGrade] = useState<GradeName | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Sync props to local state
  useEffect(() => {
    setLinksState(gradeWhatsAppLinks || {});
  }, [gradeWhatsAppLinks]);

  // Group students by grade
  const studentsByGrade = useMemo(() => {
    const map = new Map<GradeName, Student[]>();
    GRADE_ORDER.forEach((g) => map.set(g, []));

    students.forEach((s) => {
      const list = map.get(s.groupGrade);
      if (list) {
        list.push(s);
      }
    });

    return map;
  }, [students]);

  // Handle saving link
  const handleSave = (grade: GradeName) => {
    const link = (linksState[grade] || "").trim();
    onSaveGradeLink(grade, link);
    setSavedBadge(grade);
    setTimeout(() => setSavedBadge(null), 2500);
  };

  // Copy link
  const handleCopyLink = (grade: GradeName, link: string) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLinkGrade(grade);
    setTimeout(() => setCopiedLinkGrade(null), 2000);
  };

  // Export VCF Contacts
  const handleExportVCF = (grade: GradeName) => {
    const gradeStudents = studentsByGrade.get(grade) || [];
    if (gradeStudents.length === 0) {
      alert(`⚠️ لا يوجد طلاب مسجلون في [${grade}] حالياً لتصدير جهات اتصالهم.`);
      return;
    }

    const vcf = generateGradeVCard(gradeStudents, grade);
    const fileName = `جهات_اتصال_${grade.replace(/\s+/g, "_")}.vcf`;
    downloadVCardFile(vcf, fileName);
  };

  // Copy all phone numbers
  const handleCopyPhoneNumbers = (grade: GradeName) => {
    const gradeStudents = studentsByGrade.get(grade) || [];
    if (gradeStudents.length === 0) {
      alert(`⚠️ لا يوجد طلاب مسجلون في [${grade}].`);
      return;
    }

    const { text, numbers } = extractPhoneNumbersList(gradeStudents, "parents", ", ");
    if (numbers.length === 0) {
      alert(`⚠️ لم يتم العثور على أرقام هواتف مسجلة لطلاب [${grade}].`);
      return;
    }

    navigator.clipboard.writeText(text);
    setCopiedPhoneGrade(grade);
    setTimeout(() => setCopiedPhoneGrade(null), 2500);
  };

  // Export Excel
  const handleExportExcel = (grade: GradeName) => {
    const gradeStudents = studentsByGrade.get(grade) || [];
    if (gradeStudents.length === 0) {
      alert(`⚠️ لا يوجد طلاب مسجلون في [${grade}].`);
      return;
    }
    exportGradeContactsExcel(gradeStudents, grade);
  };

  // Bulk invite to WhatsApp group
  const handleBulkInvite = (grade: GradeName) => {
    const link = (linksState[grade] || "").trim();
    if (!link) {
      alert(
        `⚠️ يرجى أولاً إدخال وحفظ رابط جروب الواتساب لـ [${grade}] قبل تجهيز رسائل الدعوة!`
      );
      return;
    }

    const gradeStudents = studentsByGrade.get(grade) || [];
    if (gradeStudents.length === 0) {
      alert(`⚠️ لا يوجد طلاب مسجلون في [${grade}].`);
      return;
    }

    const confirmMsg =
      `📢 تجهيز دعوات الانضمام لجروب واتساب [${grade}]:\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 عدد الطلاب المستهدفين: ${gradeStudents.length} طالب\n` +
      `🔗 رابط الجروب: ${link}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `سيتم إنشاء رسائل مخصصة باسم كل طالب وإضافتها إلى "طابور رسائل الواتساب المعلقة".\n` +
      `هل تريد المتابعة وإضافتها للطابور الآن؟`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    let enqueuedCount = 0;
    gradeStudents.forEach((student) => {
      const phone = cleanPhoneNumber(student.parentPhone || student.phone);
      if (!phone) return;

      const messageText = generateWhatsAppGroupInvite(student, grade, link);
      enqueuePendingWhatsAppMessage({
        studentBarcode: student.barcode,
        studentName: student.name,
        grade: student.groupGrade,
        phone: student.parentPhone || student.phone,
        messageType: "عام",
        message: messageText,
      });
      enqueuedCount++;
    });

    alert(
      `✅ تم بنجاح إضافة (${enqueuedCount}) رسالة دعوة لطلاب [${grade}] في طابور رسائل الواتساب!\n` +
      `يمكنك فتح الطابور الآن وإرسالها بالترتيب بنقرة زر واحدة.`
    );

    if (onOpenWhatsAppOutbox) {
      onOpenWhatsAppOutbox();
    }
  };

  // Open QR Modal & Generate Data URL
  const handleOpenQrModal = async (grade: GradeName) => {
    const link = (linksState[grade] || "").trim();
    if (!link) {
      alert(
        `⚠️ يرجى أولاً إدخال وحفظ رابط جروب الواتساب لـ [${grade}] لعرض كود الـ QR الخاص به!`
      );
      return;
    }

    try {
      const url = await QRCode.toDataURL(link, {
        width: 360,
        margin: 2,
        color: {
          dark: "#0a0f1d",
          light: "#ffffff",
        },
      });
      setQrDataUrl(url);
      setQrModalGrade(grade);
    } catch (err) {
      console.error("QR Generation error:", err);
      alert("حدث خطأ أثناء توليد كود الـ QR!");
    }
  };

  // Download QR Code image
  const handleDownloadQrImage = () => {
    if (!qrDataUrl || !qrModalGrade) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR_جروب_واتساب_${qrModalGrade.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Print Poster
  const handlePrintPoster = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-tajawal text-slate-100">
      {/* Top Welcome & Guide Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 p-6 md:p-8 bg-gradient-to-r from-[#0a1820] via-[#0d2229] to-[#0a1820] shadow-2xl">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-fancy">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ميزة إدارة وتأسيس جروبات الواتساب المدرسية</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black font-fancy text-white">
              جروبات واتساب الصفوف الدراسية 📱
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              أنشئ وادر جروب واتساب رسمي لكل صف دراسي مع {TEACHER_NAME}. يمكنك حفظ روابط الجروبات، تصدير جهات الاتصال (ملف VCF) لحفظ الأرقام على هاتفك في ثانية واحدة، إرسال دعوات جماعية عبر الواتساب، وطباعة كود QR لتعليقه في القاعة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setShowTutorialModal(true)}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer flex-1 md:flex-initial active:scale-95"
            >
              <HelpCircle className="w-4 h-4 text-slate-950" />
              <span>دليل إنشاء وضبط الجروب (4 خطوات)</span>
            </button>

            {onOpenWhatsAppOutbox && (
              <button
                type="button"
                onClick={onOpenWhatsAppOutbox}
                className="px-4 py-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer flex-1 md:flex-initial"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>طابور الرسائل ({pendingWhatsAppCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Instructions Bar */}
        <div className="mt-6 pt-5 border-t border-slate-700/50 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-2.5 bg-slate-900/40 p-3 rounded-2xl border border-slate-700/30">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono shrink-0">
              1
            </div>
            <span>أنشئ المجموعة على واتساب والصق رابطها هنا</span>
          </div>
          <div className="flex items-center gap-2.5 bg-slate-900/40 p-3 rounded-2xl border border-slate-700/30">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold font-mono shrink-0">
              2
            </div>
            <span>صدّر ملف جهات الاتصال (VCF) لحفظ أرقام الصف بموبايلك</span>
          </div>
          <div className="flex items-center gap-2.5 bg-slate-900/40 p-3 rounded-2xl border border-slate-700/30">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold font-mono shrink-0">
              3
            </div>
            <span>اطبع كود الـ QR أو أرسل دعوة جماعية بنقرة واحدة</span>
          </div>
        </div>
      </div>

      {/* Grade Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {GRADE_ORDER.map((grade) => {
          const gradeStudents = studentsByGrade.get(grade) || [];
          const link = linksState[grade] || "";
          const isSaved = savedBadge === grade;
          const isCopied = copiedLinkGrade === grade;
          const isPhonesCopied = copiedPhoneGrade === grade;
          const hasLink = link.trim().length > 0;

          // Days breakdown
          const satCount = gradeStudents.filter((s) => s.groupDays === "سبت - إثنين - أربعاء").length;
          const sunCount = gradeStudents.filter((s) => s.groupDays === "أحد - ثلاثاء - خميس").length;

          return (
            <div
              key={grade}
              className={`rounded-3xl border transition-all duration-200 p-6 flex flex-col justify-between gap-5 bg-gradient-to-b from-[#0e1628] to-[#0a1020] shadow-xl ${
                hasLink ? "border-emerald-500/30 hover:border-emerald-500/50" : "border-slate-800 hover:border-slate-700"
              }`}
            >
              {/* Card Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-md ${
                      hasLink
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                        : "bg-slate-800 border border-slate-700 text-slate-400"
                    }`}>
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold font-fancy text-white flex items-center gap-2">
                        <span>{grade}</span>
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span className="font-bold text-amber-300 font-mono">{gradeStudents.length}</span>
                        <span>طالب مسجل</span>
                        <span className="text-slate-600">•</span>
                        <span>({satCount} سبت / {sunCount} أحد)</span>
                      </div>
                    </div>
                  </div>

                  {hasLink ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                      مفعل 🟢
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold">
                      بدون رابط
                    </span>
                  )}
                </div>

                {/* WhatsApp Group Link Input */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>🔗 رابط جروب الواتساب الخاص بالصف:</span>
                    {hasLink && (
                      <button
                        type="button"
                        onClick={() => handleCopyLink(grade, link)}
                        className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>نسخ الرابط</span>
                          </>
                        )}
                      </button>
                    )}
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      dir="ltr"
                      value={link}
                      onChange={(e) =>
                        setLinksState((prev) => ({ ...prev, [grade]: e.target.value }))
                      }
                      placeholder="https://chat.whatsapp.com/..."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 text-xs font-mono text-white placeholder:text-slate-600 outline-none transition-all"
                    />

                    <button
                      type="button"
                      onClick={() => handleSave(grade)}
                      title="حفظ الرابط ومزامنته سحابياً"
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        isSaved
                          ? "bg-emerald-500 text-white"
                          : "bg-amber-400 hover:bg-amber-300 text-slate-950"
                      }`}
                    >
                      {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      <span>{isSaved ? "تم الحفظ!" : "حفظ"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons Hub */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                {/* Row 1: External Link & QR */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={hasLink ? link : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!hasLink) {
                        e.preventDefault();
                        alert("⚠️ يرجى إدخال وحفظ رابط الجروب أولاً!");
                      }
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      hasLink
                        ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-pointer"
                        : "bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed"
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح الجروب</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleOpenQrModal(grade)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      hasLink
                        ? "bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40"
                        : "bg-slate-800/60 text-slate-500 border border-slate-800"
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>كود QR والطباعة</span>
                  </button>
                </div>

                {/* Row 2: VCF Contacts Export (The Killer Feature) */}
                <button
                  type="button"
                  onClick={() => handleExportVCF(grade)}
                  className="w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-yellow-400/20 hover:from-amber-500/30 hover:to-yellow-400/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>📇 تصدير جهات الاتصال (ملف VCF للهاتف)</span>
                </button>

                {/* Row 3: Bulk WhatsApp Invite */}
                <button
                  type="button"
                  onClick={() => handleBulkInvite(grade)}
                  className="w-full px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>📩 إرسال دعوة الانضمام للكل ({gradeStudents.length})</span>
                </button>

                {/* Row 4: Tools (Copy Numbers & Excel) */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopyPhoneNumbers(grade)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    {isPhonesCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">تم نسخ الأرقام!</span>
                      </>
                    ) : (
                      <>
                        <PhoneCall className="w-3 h-3 text-slate-400" />
                        <span>نسخ أرقام أولياء الأمور</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportExcel(grade)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                    <span>شيت Excel</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tutorial / Guide Modal */}
      {showTutorialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0c1424] border border-indigo-500/30 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-indigo-500/20 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-fancy text-white">
                    دليل إنشاء جروب واتساب احترافي لكل صف دراسي 📐
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    خطوات بسيطة تضمن تنظيم الجروب ومنع الفوضى وإضافة كل الطلاب في دقيقة واحدة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTutorialModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto text-xs text-slate-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  <strong>نصيحة ذهبية لمعلمي السنتر:</strong> احرص دائماً على جعل الجروب رسمي للإعلانات والمذكرات، وضبط إعدادات الإرسال على (المشرفون فقط)، لتجنب إزعاج أولياء الأمور بالرسائل الجانبية أو الملصقات غير الضرورية!
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold font-mono flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">إنشاء المجموعة على واتساب:</h4>
                    <p className="mt-1 text-slate-300">
                      افتح تطبيق واتساب على هاتفك أو الكمبيوتر، واضغط على خيارات ثم اختر <strong>«مجموعة جديدة / New Group»</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold font-mono flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">تسمية المجموعة بشكل واضح ورسمي:</h4>
                    <p className="mt-1 text-slate-300">
                      سمّ المجموعة باسم معبر، مثل:
                      <br />
                      <span className="inline-block mt-1 p-2 rounded-lg bg-slate-950 font-bold text-amber-300 font-fancy" dir="rtl">
                        رياضيات - الصف الأول الإعدادي 📐 | أ. إيمان الدمشيتي
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold font-mono flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">ضبط خصوصية المجموعة (المشرفون فقط):</h4>
                    <p className="mt-1 text-slate-300">
                      ادخل على <strong>معلومات المجموعة (Group Info)</strong> ➔ <strong>إعدادات المجموعة (Group Settings)</strong> ➔ اضغط على <strong>«إرسال الرسائل (Send Messages)»</strong> واختر <strong>«المشرفون فقط (Only Admins)»</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold font-mono flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">نسخ رابط الدعوة وحفظه هنا:</h4>
                    <p className="mt-1 text-slate-300">
                      من معلومات المجموعة اضغط <strong>«دعوة للمجموعة عبر رابط (Invite via link)»</strong> ➔ اختر <strong>«نسخ الرابط (Copy link)»</strong> ➔ الصق الرابط في المربع المخصص للصف هنا بالمنظومة واضغط <strong>«حفظ»</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 font-bold font-mono flex items-center justify-center shrink-0">
                    ★
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-300 text-sm">إضافة جميع الطلاب للجروب في 30 ثانية (ميزة VCF):</h4>
                    <p className="mt-1 text-slate-300">
                      اضغط على زر <strong>«📇 تصدير جهات الاتصال (ملف VCF للهاتف)»</strong> هنا بالمنظومة ➔ افتح الملف من هاتفك واضغط <strong>حفظ الكل</strong>. سيتم حفظ جميع أولياء أمور وطلاب الصف في دليل هاتفك فوراً!
                      <br />
                      الآن في واتساب اضغط داخل الجروب على <strong>«إضافة مشاركين (Add participants)»</strong> وحددهم جميعاً بضغطة واحدة دون كتابة أي رقم يدوياً!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-indigo-500/20 bg-slate-900/80 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTutorialModal(false)}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all cursor-pointer"
              >
                فهمت ذلك، إغلاق الدليل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code & Printable Poster Modal */}
      {qrModalGrade && qrDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0b1220] border border-indigo-500/30 rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-indigo-500/20 flex items-center justify-between bg-slate-900/70 no-print">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-fancy text-white">
                    كود QR وملصق الانضمام: [{qrModalGrade}]
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    امسح الكود بكاميرا الموبايل أو اطبعه كملصق A4 وعلقه بالقاعة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQrModalGrade(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Poster Container */}
            <div className="p-6 overflow-y-auto flex flex-col items-center justify-center text-center">
              <div
                id="whatsapp-printable-poster"
                className="w-full max-w-sm p-6 rounded-3xl bg-white text-slate-950 border-4 border-emerald-600 shadow-2xl flex flex-col items-center text-center space-y-4"
              >
                {/* Poster Header */}
                <div className="space-y-1">
                  <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black font-fancy">
                    منظومة الأستاذة إيمان الدمشيتي 📐
                  </div>
                  <h2 className="text-xl font-black font-fancy text-slate-950">
                    جروب الواتساب الرسمي 📱
                  </h2>
                  <p className="text-xs font-bold text-emerald-700 font-fancy">
                    {qrModalGrade}
                  </p>
                </div>

                {/* QR Code Image */}
                <div className="p-3 bg-slate-50 rounded-2xl border-2 border-emerald-500/40 shadow-inner">
                  <img
                    src={qrDataUrl}
                    alt={`QR Code ${qrModalGrade}`}
                    className="w-56 h-56 object-contain rounded-lg"
                  />
                </div>

                {/* Scan Instructions */}
                <div className="space-y-1 text-slate-700">
                  <p className="text-xs font-bold">
                    📲 افتح كاميرا الموبايل وامسح الكود للانضمام مباشرة
                  </p>
                  <p className="text-[10px] text-slate-500 font-tajawal">
                    لمتابعة الواجبات والمذكرات ومواعيد الامتحانات وتقارير الأداء الدورية
                  </p>
                </div>

                {/* Link Preview */}
                <div className="w-full pt-2 border-t border-slate-200">
                  <p className="text-[9px] font-mono text-slate-500 truncate" dir="ltr">
                    {linksState[qrModalGrade]}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-indigo-500/20 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3 no-print">
              <button
                type="button"
                onClick={handleDownloadQrImage}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>تحميل صورة الـ QR</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPoster}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <Printer className="w-4 h-4 text-slate-950" />
                <span>🖨️ طباعة ملصق القاعة A4</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
