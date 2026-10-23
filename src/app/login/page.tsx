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
    <div className="min-h-screen bg-[#081220] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* 3D Sakura Petal Ambient Layer */}
      <SakuraPetals count={20} />

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[30%] w-[550px] h-[550px] rounded-full bg-[#296ec2]/15 blur-[150px]" />
        <div className="absolute bottom-[10%] right-[20%] w-[500px] h-[500px] rounded-full bg-[#f06449]/12 blur-[160px]" />
        <div className="absolute inset-0 bg-circuit-mesh opacity-40" />
        <div className="absolute inset-0 bg-asanoha opacity-30" />
      </div>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#5c9ee6]/40 shadow-2xl shadow-[#081220]/70 mx-auto bg-[#081220] p-0.5 hover:scale-105 transition-transform duration-300">
          <img
            src="/logo.png"
            alt="RIT Japanese Portal Logo"
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <h2 className="text-2xl font-black text-white tracking-tight">
            RIT <span className="text-[#ff7c62]">JAPANESE COURSE</span>
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#296ec2]/20 text-[#93c5fd] font-japanese border border-[#296ec2]/35">
            日本語コース
          </span>
        </div>
        <p className="mt-1 text-xs text-[#ff7c62] font-bold tracking-wider uppercase">
          BELIEVE IN THE POSSIBILITIES
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        {/* Main Login Card */}
        <div className="glass-panel py-8 px-6 sm:px-10 rounded-3xl shadow-2xl space-y-6 border border-[#296ec2]/20 bg-gradient-to-b from-[#0b1a2d]/95 to-[#081220]/95">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-[#f06449]/20 border border-[#f06449]/40 text-[#ff7c62] text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address or Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dhanush, sakura, or name@rit.edu"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:border-[#f06449] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  Default: <strong className="text-emerald-400 font-bold">password123</strong>
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password123"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:border-[#f06449] focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-spring w-full py-3.5 rounded-xl bg-gradient-to-r from-[#296ec2] via-[#1b4987] to-[#f06449] hover:from-[#357fd9] hover:to-[#ff7c62] text-white font-extrabold text-xs shadow-lg shadow-[#081220]/80 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? "Verifying Credentials..." : "Sign In to Portal"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Login Pills */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 text-center">
              1-Click Demo Accounts (password: password123)
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEmail("dhanush@rit.edu");
                  setPassword("password123");
                }}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-[#296ec2]/20 border border-white/10 hover:border-[#93c5fd]/40 text-[11px] text-left transition-all cursor-pointer flex flex-col"
              >
                <span className="font-bold text-white">👤 Dhanush</span>
                <span className="text-[9px] text-emerald-400">Admin / Sensei</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail("sakura.ito@student.rit.edu");
                  setPassword("password123");
                }}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-[#296ec2]/20 border border-white/10 hover:border-[#93c5fd]/40 text-[11px] text-left transition-all cursor-pointer flex flex-col"
              >
                <span className="font-bold text-white">👩‍🎓 Sakura Ito</span>
                <span className="text-[9px] text-[#93c5fd]">Student • JLPT N1</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail("ren.takahashi@student.rit.edu");
                  setPassword("password123");
                }}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-[#296ec2]/20 border border-white/10 hover:border-[#93c5fd]/40 text-[11px] text-left transition-all cursor-pointer flex flex-col"
              >
                <span className="font-bold text-white">🧑‍🎓 Ren Takahashi</span>
                <span className="text-[9px] text-[#ff7c62]">Student • JLPT N5</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail("admin.tanaka@rit.edu");
                  setPassword("password123");
                }}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-[#296ec2]/20 border border-white/10 hover:border-[#93c5fd]/40 text-[11px] text-left transition-all cursor-pointer flex flex-col"
              >
                <span className="font-bold text-white">👨‍🏫 Tanaka Hiroshi</span>
                <span className="text-[9px] text-amber-400">Sensei / Admin</span>
              </button>
            </div>
          </div>

          <div className="pt-2 text-center">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-[#ff7c62] transition-colors inline-flex items-center gap-1.5"
            >
              <span>← Back to Course Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
