"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Plus, Trash2, Shield, User } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users || []));
  }, []);

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
      fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users || []));
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

  const inp = "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-blue-500/10 bg-slate-950/90 backdrop-blur-md sticky top-0 z-10">
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
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
              <input className={inp} type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required placeholder="password" />
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-400" /> Active Users ({users.length})
          </h2>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-800/50 hover:bg-slate-800">
                <div className="flex items-center gap-3">
                  {u.role === "admin" ? <Shield className="h-4 w-4 text-amber-400" /> : <User className="h-4 w-4 text-slate-400" />}
                  <div>
                    <span className="font-bold text-sm">{u.username}</span>
                    {u.company && <span className="text-slate-400 text-sm ml-2">({u.company})</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
                    {u.role}
                  </span>
                  <span className="text-xs text-slate-500">
                    {u.last_login ? `Last: ${u.last_login.substring(0, 10)}` : "Never"}
                  </span>
                  <button onClick={() => deleteUser(u.username)} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
