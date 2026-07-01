"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Plus, Trash2, Shield, User, Eye, EyeOff, KeyRound, Pencil, Check, X } from "lucide-react";

interface VesselUser {
  id: number;
  username: string;
  company: string;
  role: string;
  created_at: string;
  last_login: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<VesselUser[]>([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", company: "", role: "user" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Per-user UI state
  const [changePwUser, setChangePwUser] = useState<string | null>(null);
  const [changePwValue, setChangePwValue] = useState("");
  const [showChangePw, setShowChangePw] = useState(false);
  const [changePwMsg, setChangePwMsg] = useState<{ user: string; msg: string; ok: boolean } | null>(null);

  const [editUser, setEditUser] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ company: "", role: "user" });
  const [editMsg, setEditMsg] = useState<{ user: string; msg: string; ok: boolean } | null>(null);

  const refreshUsers = () =>
    fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users || []));

  useEffect(() => { refreshUsers(); }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (data.ok) {
      setSuccess(`User "${newUser.username}" created`);
      setNewUser({ username: "", password: "", company: "", role: "user" });
      refreshUsers();
    } else {
      setError(data.error);
    }
  }

  async function deleteUser(username: string) {
    if (!confirm(`Delete user "${username}"?`)) return;
    await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    setUsers(users.filter(u => u.username !== username));
  }

  async function submitChangePassword(username: string) {
    setChangePwMsg(null);
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: changePwValue }),
    });
    const data = await res.json();
    if (data.ok) {
      setChangePwMsg({ user: username, msg: "Password updated", ok: true });
      setChangePwValue("");
      setChangePwUser(null);
    } else {
      setChangePwMsg({ user: username, msg: data.error || "Error", ok: false });
    }
  }

  async function submitEditUser(username: string) {
    setEditMsg(null);
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, company: editValues.company, role: editValues.role }),
    });
    const data = await res.json();
    if (data.ok) {
      setEditMsg({ user: username, msg: "Updated", ok: true });
      setEditUser(null);
      refreshUsers();
    } else {
      setEditMsg({ user: username, msg: data.error || "Error", ok: false });
    }
  }

  const inp = "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500";
  const inpSm = "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 w-full";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-blue-500/10 bg-background/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" /> User Management
          </h1>
          <span className="text-xs text-slate-500">Admin</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Add User Form */}
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-400" /> Add New User
          </h2>
          <form onSubmit={addUser} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Username</label>
              <input className={inp} value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required placeholder="username" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Password</label>
              <div className="relative">
                <input
                  className={inp + " pr-9"}
                  type={showNewPassword ? "text" : "password"}
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  required
                  placeholder="password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Company</label>
              <input className={inp} value={newUser.company} onChange={e => setNewUser({...newUser, company: e.target.value})} placeholder="Company name" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Role</label>
              <select className={inp} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-lg text-sm">
              Add User
            </button>
          </form>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          {success && <p className="text-emerald-400 text-sm mt-3">{success}</p>}
        </div>

        {/* User List */}
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-400" /> Active Users ({users.length})
          </h2>
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                {/* Main row */}
                <div className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    {u.role === "admin" ? <Shield className="h-4 w-4 text-amber-400" /> : <User className="h-4 w-4 text-slate-400" />}
                    <div>
                      <span className="font-bold text-sm">{u.username}</span>
                      {u.company && <span className="text-slate-400 text-sm ml-2">({u.company})</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
                      {u.role}
                    </span>
                    <span className="text-xs text-slate-500">
                      {u.last_login ? `Last: ${u.last_login.substring(0, 10)}` : "Never"}
                    </span>
                    {/* Edit button */}
                    <button
                      title="Edit user"
                      onClick={() => {
                        if (editUser === u.username) {
                          setEditUser(null);
                        } else {
                          setEditUser(u.username);
                          setEditValues({ company: u.company || "", role: u.role });
                          setChangePwUser(null);
                        }
                      }}
                      className="text-slate-400 hover:text-blue-400"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {/* Change password button */}
                    <button
                      title="Change password"
                      onClick={() => {
                        if (changePwUser === u.username) {
                          setChangePwUser(null);
                        } else {
                          setChangePwUser(u.username);
                          setChangePwValue("");
                          setShowChangePw(false);
                          setEditUser(null);
                        }
                      }}
                      className="text-slate-400 hover:text-amber-400"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    {/* Delete button */}
                    <button onClick={() => deleteUser(u.username)} className="text-slate-500 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Inline: Change Password */}
                {changePwUser === u.username && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-400 mb-2">New password for <strong>{u.username}</strong></p>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 max-w-xs">
                        <input
                          className={inpSm + " pr-9"}
                          type={showChangePw ? "text" : "password"}
                          value={changePwValue}
                          onChange={e => setChangePwValue(e.target.value)}
                          placeholder="New password"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowChangePw(!showChangePw)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        >
                          {showChangePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <button
                        onClick={() => submitChangePassword(u.username)}
                        disabled={!changePwValue}
                        className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                      >
                        <Check className="h-3.5 w-3.5" /> Save
                      </button>
                      <button
                        onClick={() => setChangePwUser(null)}
                        className="text-slate-400 hover:text-slate-200 px-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {changePwMsg?.user === u.username && (
                      <p className={`text-xs mt-2 ${changePwMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {changePwMsg.msg}
                      </p>
                    )}
                  </div>
                )}

                {/* Inline: Edit User */}
                {editUser === u.username && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-400 mb-2">Edit <strong>{u.username}</strong></p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-slate-500">Company</label>
                        <input
                          className={inpSm}
                          style={{ width: "160px" }}
                          value={editValues.company}
                          onChange={e => setEditValues({ ...editValues, company: e.target.value })}
                          placeholder="Company"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-slate-500">Role</label>
                        <select
                          className={inpSm}
                          style={{ width: "110px" }}
                          value={editValues.role}
                          onChange={e => setEditValues({ ...editValues, role: e.target.value })}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="flex items-end gap-2 pb-0.5 self-end">
                        <button
                          onClick={() => submitEditUser(u.username)}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" /> Save
                        </button>
                        <button
                          onClick={() => setEditUser(null)}
                          className="text-slate-400 hover:text-slate-200 px-2 py-1.5"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {editMsg?.user === u.username && (
                      <p className={`text-xs mt-2 ${editMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {editMsg.msg}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
