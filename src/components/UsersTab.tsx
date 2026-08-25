import React, { useState } from "react";
import { UserAccount, PermissionKey } from "../types";
import { ALL_PERMISSIONS } from "../utils/storage";
import { Users, UserPlus, Shield, KeyRound, Trash2, Edit3, CheckSquare, Square } from "lucide-react";

interface UsersTabProps {
  usersList: UserAccount[];
  currentUser: UserAccount;
  onAddUser: (user: UserAccount) => void;
  onUpdateUser: (originalUsername: string, updated: UserAccount) => void;
  onDeleteUser: (username: string) => void;
}

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  add_student: "➕ إضافة طالب جديد",
  edit_student: "✏️ تعديل بيانات الطالب",
  delete_student: "🗑️ حذف الطلاب",
  change_status: "🔄 تغيير حالة الحضور",
  pay_expenses: "💳 إثبات دفع الاشتراك",
  view_revenues: "💰 رؤية الإيرادات والإحصائيات",
  add_grades: "📝 رصد الدرجات",
  send_messages: "📲 إرسال الرسائل والمراسلة",
  manage_prices: "🏷️ تعديل أسعار المجموعات",
  early_warning: "🚨 نظام الإنذار المبكر",
  certificates: "📜 إصدار شهادات التقدير",
  excel_integration: "📥 استيراد وتصدير Excel",
};

export const UsersTab: React.FC<UsersTabProps> = ({
  usersList,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "secretary">("secretary");
  const [selectedPerms, setSelectedPerms] = useState<PermissionKey[]>([
    "add_student",
    "edit_student",
    "change_status",
    "pay_expenses",
    "add_grades",
    "send_messages",
    "certificates",
  ]);

  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [originalEditUsername, setOriginalEditUsername] = useState("");

  const handleTogglePerm = (perm: PermissionKey) => {
    if (selectedPerms.includes(perm)) {
      setSelectedPerms(selectedPerms.filter((p) => p !== perm));
    } else {
      setSelectedPerms([...selectedPerms, perm]);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const u = newUsername.trim();
    const p = newPassword.trim();
    if (!u || !p) {
      alert("⚠️ يرجى إدخال اسم المستخدم وكلمة المرور!");
      return;
    }

    if (usersList.some((user) => user.username === u)) {
      alert("⚠️ اسم المستخدم موجود بالفعل!");
      return;
    }

    const newUser: UserAccount = {
      username: u,
      pass: p,
      role: newRole,
      permissions: newRole === "admin" ? [...ALL_PERMISSIONS] : selectedPerms,
    };

    onAddUser(newUser);
    alert(`✅ تم إنشاء حساب (${u}) بنجاح!`);
    setNewUsername("");
    setNewPassword("");
  };

  const handleOpenEdit = (user: UserAccount) => {
    setOriginalEditUsername(user.username);
    setEditingUser({ ...user });
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    onUpdateUser(originalEditUsername, {
      ...editingUser,
      permissions:
        editingUser.role === "admin" ? [...ALL_PERMISSIONS] : editingUser.permissions || [],
    });

    alert("✅ تم تعديل بيانات المستخدم وصلاحياته بنجاح!");
    setEditingUser(null);
  };

  const adminCount = usersList.filter((u) => u.role === "admin").length;

  return (
    <div className="space-y-6">
      {/* Create User Card */}
      <div className="bg-[#121926]/90 border border-amber-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-amber-500/20">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-400">
              إضافة حساب مستخدم جديد وتحديد الصلاحيات
            </h2>
            <p className="text-xs text-slate-400">
              إنشاء حسابات سكرتارية بصلاحيات محددة أو مسؤولين كاملين (أدمن)
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-bold">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300">اسم المستخدم (Username) *</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="مثال: secretary1"
                className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 px-3 py-2.5 rounded-xl outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300">كلمة المرور (Password) *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 px-3 py-2.5 rounded-xl outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300">نوع الحساب *</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "admin" | "secretary")}
                className="w-full bg-[#090e17] border border-amber-500/30 text-slate-100 px-3 py-2.5 rounded-xl outline-none cursor-pointer"
              >
                <option value="secretary">سكرتارية (صلاحيات مخصصة)</option>
                <option value="admin">مسؤول كامل (الأدمن)</option>
              </select>
            </div>
          </div>

          {newRole === "secretary" && (
            <div className="bg-[#090e17] p-4 rounded-xl border border-amber-500/20 space-y-2.5">
              <label className="text-amber-300 text-xs block">
                حدد الصلاحيات الممنوحة لهذا الحساب:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ALL_PERMISSIONS.map((perm) => {
                  const isChecked = selectedPerms.includes(perm);
                  return (
                    <label
                      key={perm}
                      className="flex items-center gap-2 text-slate-300 cursor-pointer select-none text-[11px]"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePerm(perm)}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                      <span>{PERMISSION_LABELS[perm] || perm}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black text-xs shadow-md hover:from-amber-400"
          >
            إضافة المستخدم ➕
          </button>
        </form>
      </div>

      {/* Users List Table */}
      <div className="bg-[#121926]/90 border border-amber-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-amber-500/20 bg-slate-900/60 flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-amber-400 flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>قائمة المستخدمين المسجلين في المنظومة</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-amber-400 font-extrabold border-b border-amber-500/30">
                <th className="p-3">اسم المستخدم</th>
                <th className="p-3">نوع الحساب</th>
                <th className="p-3">الصلاحيات الممنوحة</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {usersList.map((user) => {
                const isOnlyAdmin = user.role === "admin" && adminCount <= 1;

                return (
                  <tr key={user.username} className="hover:bg-amber-500/5 transition-colors">
                    <td className="p-3 font-bold text-slate-100">{user.username}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          user.role === "admin"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        }`}
                      >
                        {user.role === "admin" ? "👑 مسؤول كامل (أدمن)" : "👤 سكرتارية"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 max-w-xs text-[11px] truncate">
                      {user.role === "admin"
                        ? "كافة الصلاحيات مفتوحة"
                        : user.permissions?.map((p) => PERMISSION_LABELS[p] || p).join("، ") ||
                          "بدون صلاحيات"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(user)}
                          className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>

                        {!isOnlyAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف حساب (${user.username})؟`)) {
                                onDeleteUser(user.username);
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121926] border border-amber-500/40 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-amber-400 border-b border-amber-500/20 pb-2">
              تعديل حساب المستخدم ({originalEditUsername})
            </h3>

            <form onSubmit={handleSaveEditUser} className="space-y-3 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-slate-300">اسم المستخدم:</label>
                <input
                  type="text"
                  required
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="w-full bg-[#090e17] border border-slate-700 text-slate-100 px-3 py-2 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">
                  كلمة مرور جديدة (اتركها كما هي إذا لم ترغب في التغيير):
                </label>
                <input
                  type="password"
                  value={editingUser.pass}
                  onChange={(e) => setEditingUser({ ...editingUser, pass: e.target.value })}
                  className="w-full bg-[#090e17] border border-slate-700 text-slate-100 px-3 py-2 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">نوع الحساب:</label>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      role: e.target.value as "admin" | "secretary",
                    })
                  }
                  className="w-full bg-[#090e17] border border-slate-700 text-slate-100 px-3 py-2 rounded-xl"
                >
                  <option value="secretary">سكرتارية</option>
                  <option value="admin">مسؤول كامل (أدمن)</option>
                </select>
              </div>

              {editingUser.role === "secretary" && (
                <div className="bg-[#090e17] p-3 rounded-xl border border-slate-800 space-y-2 max-h-48 overflow-y-auto">
                  <label className="text-amber-300 text-[11px] block">الصلاحيات:</label>
                  {ALL_PERMISSIONS.map((perm) => {
                    const isChecked = editingUser.permissions?.includes(perm) ?? false;
                    return (
                      <label
                        key={perm}
                        className="flex items-center gap-2 text-slate-300 text-[11px] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const cur = editingUser.permissions || [];
                            const updated = cur.includes(perm)
                              ? cur.filter((p) => p !== perm)
                              : [...cur, perm];
                            setEditingUser({ ...editingUser, permissions: updated });
                          }}
                          className="w-3.5 h-3.5 accent-amber-500"
                        />
                        <span>{PERMISSION_LABELS[perm]}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black font-black"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
