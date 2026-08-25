import React, { useState, useEffect } from "react";
import {
  Student,
  PaymentRecord,
  UserAccount,
  GradeName,
  GroupDays,
  TabType,
} from "./types";
import {
  loadInitialData,
  saveStudentsData,
  saveAttendanceTodayData,
  savePaymentsData,
  saveGroupPricesData,
  saveUsersData,
  subscribeToCloudData,
} from "./utils/storage";
import {
  getTodayKey,
  getCurrentMonthKey,
  formatArabicDate,
  formatTimeArabic,
  openWhatsApp,
} from "./utils/helpers";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { AttendanceScanner } from "./components/AttendanceScanner";
import { AddStudentTab } from "./components/AddStudentTab";
import { DailyAttendanceReport } from "./components/DailyAttendanceReport";
import { CumulativeGradesReport } from "./components/CumulativeGradesReport";
import { PayExpensesTab } from "./components/PayExpensesTab";
import { FinancialsTab } from "./components/FinancialsTab";
import { ExamGradesTab } from "./components/ExamGradesTab";
import { EarlyWarningTab } from "./components/EarlyWarningTab";
import { CertificatesTab } from "./components/CertificatesTab";
import { ExcelIntegrationTab } from "./components/ExcelIntegrationTab";
import { WhatsAppDirectTab } from "./components/WhatsAppDirectTab";
import { ManageStudentsTab } from "./components/ManageStudentsTab";
import { UsersTab } from "./components/UsersTab";
import { SettingsTab } from "./components/SettingsTab";
import { AuthOverlay } from "./components/AuthOverlay";
import { PrintPDFModal } from "./components/PrintPDFModal";
import { PrintCardsModal } from "./components/PrintCardsModal";

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("attendance-scan");
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSessionSlotId, setActiveSessionSlotId] = useState<string>("auto");
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isCardsModalOpen, setIsCardsModalOpen] = useState(false);

  // Core Datasets with guaranteed initial default arrays/objects
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<Record<string, string>>({});
  const [attendanceHistory, setAttendanceHistory] = useState<Record<string, Record<string, string>>>({});
  const [scanLogOrder, setScanLogOrder] = useState<string[]>([]);
  const [scanLogTimes, setScanLogTimes] = useState<Record<string, string>>({});
  const [payments, setPayments] = useState<Record<string, Record<string, PaymentRecord>>>({});
  const [groupPrices, setGroupPrices] = useState<Record<GradeName, number>>({} as Record<GradeName, number>);
  const [usersList, setUsersList] = useState<UserAccount[]>([]);

  // Print PDF Modal State
  const [printModal, setPrintModal] = useState<{
    open: boolean;
    type: "attendance" | "exams" | "all";
  }>({
    open: false,
    type: "all",
  });

  // 1. Initial Local Data Load (Instant Speed)
  useEffect(() => {
    const data = loadInitialData();
    if (data) {
      setStudents(data.students || []);
      setAttendanceToday(data.attendanceToday || {});
      setAttendanceHistory(data.attendanceHistory || {});
      setScanLogOrder(data.scanLogOrder || []);
      setScanLogTimes(data.scanLogTimes || {});
      setPayments(data.payments || {});
      setGroupPrices(data.groupPrices || ({} as Record<GradeName, number>));
      setUsersList(data.usersList || []);
      if (data.activeSessionSlotId) {
        setActiveSessionSlotId(data.activeSessionSlotId);
      }
    }
  }, []);

  // 2. Real-time Firebase Sync in background
  useEffect(() => {
    const unsubscribe = subscribeToCloudData(
      (cloudData) => {
        setIsLiveConnected(true);
        if (cloudData) {
          if (cloudData.students) setStudents(cloudData.students);
          if (cloudData.attendanceToday) setAttendanceToday(cloudData.attendanceToday);
          if (cloudData.attendanceHistory) setAttendanceHistory(cloudData.attendanceHistory);
          if (cloudData.scanLogOrder) setScanLogOrder(cloudData.scanLogOrder);
          if (cloudData.scanLogTimes) setScanLogTimes(cloudData.scanLogTimes);
          if (cloudData.payments) setPayments(cloudData.payments);
          if (cloudData.groupPrices) setGroupPrices(cloudData.groupPrices);
          if (cloudData.usersList) setUsersList(cloudData.usersList);
          if (cloudData.activeSessionSlotId) setActiveSessionSlotId(cloudData.activeSessionSlotId);
        }
      },
      () => {
        setIsLiveConnected(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Handler: Scan Attendance Record
  const handleRecordAttendance = (
    barcode: string,
    status: "حضور" | "تأخير",
    timeIso: string,
    student: Student
  ) => {
    const updatedToday = { ...attendanceToday, [barcode]: status };
    const todayKey = getTodayKey();
    const updatedHistory = {
      ...attendanceHistory,
      [todayKey]: updatedToday,
    };
    const updatedOrder = scanLogOrder.includes(barcode)
      ? scanLogOrder
      : [barcode, ...scanLogOrder];
    const updatedTimes = { ...scanLogTimes, [barcode]: timeIso };

    const prevStatus = attendanceToday[barcode];
    const updatedStudents = students.map((s) => {
      if (s.barcode === barcode) {
        let attCount = s.totalAttendanceDays || 0;
        let absCount = s.totalAbsentDays || 0;
        if (!prevStatus) {
          attCount += 1;
        }
        return {
          ...s,
          totalAttendanceDays: attCount,
          totalAbsentDays: absCount,
        };
      }
      return s;
    });

    setAttendanceToday(updatedToday);
    setAttendanceHistory(updatedHistory);
    setScanLogOrder(updatedOrder);
    setScanLogTimes(updatedTimes);
    setStudents(updatedStudents);

    saveAttendanceTodayData(updatedToday);
    saveStudentsData(updatedStudents);
  };

  // Handler: Finish and Lock Group Session
  const handleFinishGroup = (
    grade: GradeName,
    days: GroupDays,
    absentList: { student: Student; message: string }[],
    lateList: { student: Student; message: string }[]
  ) => {
    const updatedToday = { ...attendanceToday };
    const absentBarcodes = absentList.map((a) => a.student.barcode);
    absentBarcodes.forEach((barcode) => {
      if (!updatedToday[barcode]) {
        updatedToday[barcode] = "غائب";
      }
    });

    const todayKey = getTodayKey();
    const updatedHistory = {
      ...attendanceHistory,
      [todayKey]: updatedToday,
    };

    const updatedStudents = students.map((s) => {
      if (absentBarcodes.includes(s.barcode)) {
        return {
          ...s,
          totalAbsentDays: (s.totalAbsentDays || 0) + 1,
        };
      }
      return s;
    });

    setAttendanceToday(updatedToday);
    setAttendanceHistory(updatedHistory);
    setStudents(updatedStudents);
    setScanLogOrder([]);
    setScanLogTimes({});

    saveAttendanceTodayData(updatedToday);
    saveStudentsData(updatedStudents);

    if (absentList.length > 0 || lateList.length > 0) {
      const shouldSend = confirm(
        `تم إثبات الحضور والغياب للمجموعة بنجاح!\nيوجد (${absentList.length}) غائب و (${lateList.length}) متأخر.\nهل ترغب في مراسلة أول غائب عبر الواتساب الآن؟`
      );
      if (shouldSend && absentList.length > 0) {
        openWhatsApp(absentList[0].student.parentPhone, absentList[0].message);
      }
    } else {
      alert("✅ تم إثبات الحضور والغياب لجميع طلاب المجموعة بنجاح!");
    }
  };

  // Handler: Add Single Student
  const handleAddStudent = (newStudent: Student, cardFee = 0) => {
    const updated = [newStudent, ...students];
    setStudents(updated);
    saveStudentsData(updated);

    if (cardFee > 0) {
      const today = getTodayKey();
      const monthKey = getCurrentMonthKey();
      const newPayment: PaymentRecord = {
        barcode: newStudent.barcode,
        month: monthKey,
        monthKey,
        amount: cardFee,
        date: today,
        time: formatTimeArabic(),
        note: "رسوم استخراج كارت الباركود الذكي",
        isCardFee: true,
        recordedBy: currentUser?.username || "admin",
      };
      const monthData = payments[monthKey] || {};
      const updatedPayments = {
        ...payments,
        [monthKey]: {
          ...monthData,
          [`card_${newStudent.barcode}`]: newPayment,
        },
      };
      setPayments(updatedPayments);
      savePaymentsData(updatedPayments);
    }
  };

  // Handler: Bulk Import Students from Excel
  const handleBulkImport = (newStudentsList: Student[]) => {
    const updated = [...newStudentsList, ...students];
    setStudents(updated);
    saveStudentsData(updated);
  };

  // Handler: Update Student Info
  const handleUpdateStudent = (oldBarcode: string, updatedStudent: Student) => {
    const updated = students.map((s) => (s.barcode === oldBarcode ? updatedStudent : s));
    setStudents(updated);
    saveStudentsData(updated);
  };

  // Handler: Delete Single Student
  const handleDeleteStudent = (barcode: string) => {
    const updated = students.filter((s) => s.barcode !== barcode);
    setStudents(updated);
    saveStudentsData(updated);
  };

  // Handler: Clear All Data
  const handleClearAllData = () => {
    setStudents([]);
    setAttendanceToday({});
    setScanLogOrder([]);
    setScanLogTimes({});
    saveStudentsData([]);
    saveAttendanceTodayData({});
    alert("تم مسح كافة البيانات بنجاح.");
  };

  // Handler: Manual Status Change in Attendance Report
  const handleChangeAttendanceStatus = (barcode: string, dateKey: string, newStatus: string) => {
    const dateMap = attendanceHistory[dateKey] || {};
    const updatedDateMap = { ...dateMap, [barcode]: newStatus };
    const updatedHistory = { ...attendanceHistory, [dateKey]: updatedDateMap };

    setAttendanceHistory(updatedHistory);
    const todayKey = getTodayKey();
    if (dateKey === todayKey) {
      setAttendanceToday(updatedDateMap);
      saveAttendanceTodayData(updatedDateMap);
    }

    const updatedStudents = students.map((s) => {
      if (s.barcode === barcode) {
        let attCount = s.totalAttendanceDays || 0;
        let absCount = s.totalAbsentDays || 0;
        if (newStatus === "حضور" || newStatus === "تأخير") {
          attCount++;
        } else if (newStatus === "غائب") {
          absCount++;
        }
        return {
          ...s,
          totalAttendanceDays: attCount,
          totalAbsentDays: absCount,
        };
      }
      return s;
    });

    setStudents(updatedStudents);
    saveStudentsData(updatedStudents);
  };

  // Handler: Record Payment
  const handleRecordPayment = (
    barcode: string,
    amount: number,
    monthKey: string,
    note?: string
  ) => {
    const today = getTodayKey();
    const time = formatTimeArabic();

    const monthData = payments[monthKey] || {};
    const newRecord: PaymentRecord = {
      barcode,
      month: monthKey,
      monthKey,
      amount,
      date: today,
      time,
      note: note || `اشتراك شهر ${monthKey}`,
      recordedBy: currentUser?.username || "admin",
    };

    const updatedPayments = {
      ...payments,
      [monthKey]: {
        ...monthData,
        [barcode]: newRecord,
      },
    };

    setPayments(updatedPayments);
    savePaymentsData(updatedPayments);
  };

  // Handler: Record Exam Grade
  const handleRecordExamGrade = (
    barcode: string,
    examTitle: string,
    score: number,
    maxScore: number
  ) => {
    const pct = Math.round((score / maxScore) * 100);
    const scoreFormatted = `${score}/${maxScore} (${pct}%)`;

    const updated = students.map((s) => {
      if (s.barcode === barcode) {
        const scores = s.totalExamScores ? [...s.totalExamScores, pct] : [pct];
        const pointsBonus = pct === 100 ? 20 : pct >= 90 ? 10 : pct >= 75 ? 5 : 0;

        return {
          ...s,
          lastExamTitle: examTitle,
          lastExamScore: scoreFormatted,
          totalExamScores: scores,
          points: (s.points || 0) + pointsBonus,
        };
      }
      return s;
    });

    setStudents(updated);
    saveStudentsData(updated);
  };

  // Handler: Update Grade Record from Cumulative Table
  const handleUpdateGradeRecord = (
    barcode: string,
    lastTitle: string,
    lastScore: string,
    newPoints: number,
    updatedScores: number[]
  ) => {
    const updated = students.map((s) => {
      if (s.barcode === barcode) {
        return {
          ...s,
          lastExamTitle: lastTitle,
          lastExamScore: lastScore,
          points: newPoints,
          totalExamScores: updatedScores,
        };
      }
      return s;
    });
    setStudents(updated);
    saveStudentsData(updated);
  };

  // Handler: Manage Users
  const handleAddUser = (newUser: UserAccount) => {
    const updated = [...usersList, newUser];
    setUsersList(updated);
    saveUsersData(updated);
  };

  const handleUpdateUser = (originalUsername: string, updatedUser: UserAccount) => {
    const updated = usersList.map((u) =>
      u.username === originalUsername ? updatedUser : u
    );
    setUsersList(updated);
    saveUsersData(updated);
    if (currentUser?.username === originalUsername) {
      setCurrentUser(updatedUser);
    }
  };

  const handleDeleteUser = (username: string) => {
    const updated = usersList.filter((u) => u.username !== username);
    setUsersList(updated);
    saveUsersData(updated);
  };

  // Handler: Change Password
  const handleChangePassword = (newPass: string) => {
    if (!currentUser) return;
    const updated = usersList.map((u) =>
      u.username === currentUser.username ? { ...u, pass: newPass } : u
    );
    setUsersList(updated);
    saveUsersData(updated);
    setCurrentUser({ ...currentUser, pass: newPass });
  };

  // Handler: Update Group Default Price
  const handleUpdateGroupPrice = (grade: GradeName, newPrice: number) => {
    const updated = { ...groupPrices, [grade]: newPrice };
    setGroupPrices(updated);
    saveGroupPricesData(updated);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#090e17] text-slate-100 font-['Tajawal',sans-serif] selection:bg-amber-500 selection:text-black"
    >
      {/* 1. Auth Overlay (Login) */}
      {!currentUser && (
        <AuthOverlay
          usersList={usersList}
          onLoginSuccess={(user) => setCurrentUser(user)}
        />
      )}

      {currentUser && (
        <div className="flex flex-col min-h-screen">
          {/* Top Navbar */}
          <Navbar
            currentUser={currentUser}
            currentDateText={formatArabicDate()}
            isOnline={isLiveConnected}
            theme={theme}
            onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
            onLogout={() => setCurrentUser(null)}
            activeSessionSlotId={activeSessionSlotId}
            onChangeSessionSlot={(slotId) => setActiveSessionSlotId(slotId)}
            onOpenQuickScan={() => setActiveTab("attendance-scan")}
            onOpenPrintAllPDF={() => setPrintModal({ open: true, type: "all" })}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />

          {/* Main Layout Area */}
          <div className="flex flex-1 min-w-0">
            {/* Sidebar Navigation */}
            <Sidebar
              activeTab={activeTab}
              currentUser={currentUser}
              isOpen={isSidebarOpen}
              onSelectTab={(tab) => {
                setActiveTab(tab);
                setIsSidebarOpen(false);
              }}
              onCloseMobile={() => setIsSidebarOpen(false)}
              onOpenPdfModal={(type) => setPrintModal({ open: true, type })}
              onOpenPrintCards={() => setIsCardsModalOpen(true)}
            />

            {/* Tab Body View Container */}
            <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0">
              {activeTab === "attendance-scan" && (
                <AttendanceScanner
                  students={students}
                  attendanceToday={attendanceToday}
                  scanLogOrder={scanLogOrder}
                  scanLogTimes={scanLogTimes}
                  payments={payments}
                  activeSessionSlotId={activeSessionSlotId}
                  voiceEnabled={voiceEnabled}
                  onRecordAttendance={handleRecordAttendance}
                  onFinishGroup={handleFinishGroup}
                />
              )}

              {activeTab === "add-student" && (
                <AddStudentTab
                  students={students}
                  groupPrices={groupPrices}
                  onAddStudent={handleAddStudent}
                />
              )}

              {activeTab === "stats" && (
                <DailyAttendanceReport
                  students={students}
                  attendanceHistory={attendanceHistory}
                  onUpdateStatus={handleChangeAttendanceStatus}
                  onOpenPdfModal={(type) => setPrintModal({ open: true, type })}
                />
              )}

              {activeTab === "cumulative-report" && (
                <CumulativeGradesReport
                  students={students}
                  onUpdateGradeRecord={handleUpdateGradeRecord}
                  onOpenPdfModal={(type) => setPrintModal({ open: true, type })}
                />
              )}

              {activeTab === "pay-expenses" && (
                <PayExpensesTab
                  students={students}
                  payments={payments}
                  groupPrices={groupPrices}
                  onRecordPayment={handleRecordPayment}
                />
              )}

              {activeTab === "expenses" && (
                <FinancialsTab
                  students={students}
                  payments={payments}
                  groupPrices={groupPrices}
                />
              )}

              {activeTab === "grades" && (
                <ExamGradesTab
                  students={students}
                  onRecordGrade={handleRecordExamGrade}
                />
              )}

              {activeTab === "early-warning" && (
                <EarlyWarningTab
                  students={students}
                  payments={payments}
                />
              )}

              {activeTab === "certificates" && (
                <CertificatesTab students={students} />
              )}

              {activeTab === "excel-integration" && (
                <ExcelIntegrationTab
                  students={students}
                  payments={payments}
                  attendanceHistory={attendanceHistory}
                  onBulkImportStudents={handleBulkImport}
                />
              )}

              {activeTab === "whatsapp-engine" && (
                <WhatsAppDirectTab students={students} />
              )}

              {activeTab === "manage-students" && (
                <ManageStudentsTab
                  students={students}
                  onUpdateStudent={handleUpdateStudent}
                  onDeleteStudent={handleDeleteStudent}
                  onClearAllData={handleClearAllData}
                  onOpenPrintCards={() => setIsCardsModalOpen(true)}
                />
              )}

              {activeTab === "users" && (
                <UsersTab
                  usersList={usersList}
                  currentUser={currentUser}
                  onAddUser={handleAddUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                />
              )}

              {activeTab === "settings" && (
                <SettingsTab
                  currentUser={currentUser}
                  groupPrices={groupPrices}
                  onChangePassword={handleChangePassword}
                  onUpdateGroupPrice={handleUpdateGroupPrice}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Grade-by-Grade Independent PDF Multi-Page Modal */}
      {printModal.open && (
        <PrintPDFModal
          type={printModal.type}
          students={students}
          attendanceToday={attendanceToday}
          onClose={() => setPrintModal({ ...printModal, open: false })}
        />
      )}

      {/* Student Barcode ID Cards Grid Modal */}
      {isCardsModalOpen && (
        <PrintCardsModal
          students={students}
          onClose={() => setIsCardsModalOpen(false)}
        />
      )}
    </div>
  );
}
