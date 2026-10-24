"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SakuraPetals from "@/components/ui/SakuraPetals";
import { Lock, Mail, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(data.redirectUrl);
        router.refresh();
      } else {
        setErrorMessage(data.error || "Authentication failed");
      }
    } catch (err) {
      setErrorMessage("Network error during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-japanese-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* 3D Sakura Petal Ambient Layer */}
      <SakuraPetals count={20} />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#d9381e]/40 shadow-xl mx-auto bg-white p-0.5 hover:scale-105 transition-transform duration-300">
          <img
            src="/logo.png"
            alt="RIT Japanese Portal Logo"
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            RIT <span className="text-[#d9381e]">JAPANESE COURSE</span>
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-japanese border border-blue-200">
            日本語コース
          </span>
        </div>
        <p className="mt-1 text-xs text-[#d9381e] font-bold tracking-wider uppercase">
          BELIEVE IN THE POSSIBILITIES • 信は力なり
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        {/* Main Login Card */}
        <div className="card-japanese-elevated py-8 px-6 sm:px-10 rounded-3xl shadow-xl space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address or Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dhanush, sakura, or name@rit.edu"
                  className="w-full bg-[#f8f6f0] border border-[#e7e2d7] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#d9381e] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Default: <strong className="text-emerald-700 font-bold">password123</strong>
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password123"
                  className="w-full bg-[#f8f6f0] border border-[#e7e2d7] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#d9381e] focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-spring w-full py-3.5 rounded-xl bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#d9381e] hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-[#d9381e]/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? "Verifying Credentials..." : "Sign In to Portal"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Login Pills */}
          <div className="space-y-2 pt-2 border-t border-[#e7e2d7]">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 text-center">
              1-Click Demo Accounts (Password: <code className="text-[#b45309] font-bold">password123</code>)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("sakura");
                  setPassword("password123");
                }}
                className="p-2.5 rounded-xl bg-[#faf8f4] hover:bg-white border border-[#e7e2d7] hover:border-blue-400 text-[11px] text-left transition-all cursor-pointer flex flex-col group shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 group-hover:text-blue-700">👩‍🎓 Sakura</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono font-bold">N1</span>
                </div>
                <span className="text-[9px] text-slate-500">Student • `sakura`</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail("dhanush");
                  setPassword("password123");
                }}
                className="p-2.5 rounded-xl bg-[#faf8f4] hover:bg-white border border-[#e7e2d7] hover:border-emerald-500 text-[11px] text-left transition-all cursor-pointer flex flex-col group shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 group-hover:text-emerald-700">👤 Dhanush</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">Admin</span>
                </div>
                <span className="text-[9px] text-slate-500">Sensei / `dhanush`</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail("ren");
                  setPassword("password123");
                }}
                className="p-2.5 rounded-xl bg-[#faf8f4] hover:bg-white border border-[#e7e2d7] hover:border-[#d9381e] text-[11px] text-left transition-all cursor-pointer flex flex-col group shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 group-hover:text-[#d9381e]">🧑‍🎓 Ren</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold">N5</span>
                </div>
                <span className="text-[9px] text-slate-500">Student • `ren`</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail("admin.tanaka@rit.edu");
                  setPassword("password123");
                }}
                className="p-2.5 rounded-xl bg-[#faf8f4] hover:bg-white border border-[#e7e2d7] hover:border-amber-500 text-[11px] text-left transition-all cursor-pointer flex flex-col group shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 group-hover:text-amber-700">👨‍🏫 Tanaka</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold">Staff</span>
                </div>
                <span className="text-[9px] text-slate-500">Faculty Sensei</span>
              </button>
            </div>
          </div>

          <div className="pt-2 text-center">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-[#d9381e] transition-colors inline-flex items-center gap-1.5 font-medium"
            >
              <span>← Back to Course Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
