"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import Navbar from "@/components/navigation/Navbar";
import { UserSession } from "@/lib/types";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Smartphone,
  ShieldCheck,
  ArrowLeft,
  ScanLine,
  Compass,
} from "lucide-react";

type ScannerState = "init" | "scanning" | "submitting" | "success" | "error";

interface SuccessData {
  courseCode?: string;
  distanceMeters?: number;
  timestamp?: string;
  message?: string;
}

export default function StudentQrScannerPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [state, setState] = useState<ScannerState>("init");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [submissionProgress, setSubmissionProgress] = useState<string>(
    "Verifying room location and device token..."
  );

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasStartedRef = useRef<boolean>(false);

  // Read or generate persistent device UUID
  const getDeviceHash = (): string => {
    if (typeof window === "undefined") return "device-fallback";
    let hash = localStorage.getItem("attendance_device_uuid");
    if (!hash) {
      hash =
        "hw-" +
        (window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));
      localStorage.setItem("attendance_device_uuid", hash);
    }
    return hash;
  };

  // 1. Authenticate user
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login?from=/student/scan");
          return;
        }
        const data = await res.json();
        setUser(data.user);
        setState("scanning");
      } catch (err) {
        setErrorMessage("Authentication failed. Please log in again.");
        setState("error");
      }
    }
    loadUser();
  }, [router]);

  // 2. Initialize and start camera scanner
  const startCamera = async () => {
    if (typeof window === "undefined" || hasStartedRef.current) return;

    try {
      setErrorMessage(null);
      setState("scanning");

      const element = document.getElementById("qr-reader-container");
      if (!element) return;

      const html5Qrcode = new Html5Qrcode("qr-reader-container");
      scannerRef.current = html5Qrcode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5Qrcode.start(
        { facingMode: "environment" }, // Prefer back camera on mobile
        config,
        onQrCodeSuccess,
        () => {} // Ignore scan failure frames
      );

      hasStartedRef.current = true;
    } catch (err: any) {
      console.warn("Camera start error:", err);
      // Fallback to any camera if environment camera fails
      try {
        if (scannerRef.current) {
          await scannerRef.current.start(
            {},
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onQrCodeSuccess,
            () => {}
          );
          hasStartedRef.current = true;
          return;
        }
      } catch (fallbackErr) {
        // Fallback failed
      }

      setErrorMessage(
        "Camera access was denied or is unavailable. Please ensure camera permissions are allowed in your browser settings."
      );
      setState("error");
    }
  };

  useEffect(() => {
    if (state === "scanning" && user && !hasStartedRef.current) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [state, user]);

  const stopCamera = async () => {
    if (scannerRef.current && hasStartedRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // Ignored
      } finally {
        hasStartedRef.current = false;
        scannerRef.current = null;
      }
    }
  };

  // 3. Handle QR Code Detection
  const onQrCodeSuccess = async (decodedText: string) => {
    // Immediately stop camera to lock viewfinder and conserve battery
    await stopCamera();

    let sessionId = "";
    let token = "";

    try {
      const parsed = JSON.parse(decodedText);
      sessionId = parsed.sessionId;
      token = parsed.token;
    } catch {
      setErrorMessage("Invalid QR code scanned. Please scan the official classroom QR code.");
      setState("error");
      return;
    }

    if (!sessionId || !token) {
      setErrorMessage("Scanned QR is missing session or token parameters.");
      setState("error");
      return;
    }

    setState("submitting");
    setSubmissionProgress("Acquiring GPS location for classroom geofence...");

    // Check Geolocation support
    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser. GPS is required for classroom verification.");
      setState("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setSubmissionProgress("Validating dynamic token and anti-proxy locks...");
        await submitAttendance(
          sessionId,
          token,
          position.coords.latitude,
          position.coords.longitude
        );
      },
      (geoError) => {
        let msg = "Could not get your GPS location. Please allow location access to verify attendance.";
        if (geoError.code === geoError.PERMISSION_DENIED) {
          msg = "GPS permission was denied. You must allow location access to prove you are inside the classroom.";
        } else if (geoError.code === geoError.TIMEOUT) {
          msg = "GPS request timed out. Please check your device location settings and retry.";
        }
        setErrorMessage(msg);
        setState("error");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // 4. Submit to Check-In API
  const submitAttendance = async (
    sessionId: string,
    token: string,
    latitude: number,
    longitude: number
  ) => {
    try {
      const deviceHash = getDeviceHash();

      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          token,
          latitude,
          longitude,
          deviceHash,
          studentId: user?.id,
          studentName: user?.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Attendance verification failed.");
      }

      setSuccessData({
        courseCode: result.courseCode || "Verified Course",
        distanceMeters: result.attendance?.distanceMeters,
        timestamp: result.attendance?.timestamp || new Date().toISOString(),
        message: result.message,
      });

      setState("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to record attendance.");
      setState("error");
    }
  };

  const handleRetry = async () => {
    await stopCamera();
    setErrorMessage(null);
    setSuccessData(null);
    setState("scanning");
    setTimeout(() => {
      startCamera();
    }, 150);
  };

  return (
    <div className="min-h-screen bg-[#081220] text-slate-100 flex flex-col justify-between selection:bg-[#f06449] selection:text-white">
      {user && <Navbar user={user} />}

      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-center items-center">
        {/* Header Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f06449]/20 text-[#ff7c62] text-xs font-bold border border-[#f06449]/30 mb-2">
            <ScanLine className="w-3.5 h-3.5" />
            Classroom QR Verification
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Mark Session Attendance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Point camera at the teacher&apos;s dynamic screen. Your GPS &amp; device hardware will be verified.
          </p>
        </div>

        {/* Viewfinder Card */}
        <div className="w-full bg-slate-900/80 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur-xl flex flex-col items-center">
          {/* STATE 1: SCANNING VIEW */}
          {state === "scanning" && (
            <div className="w-full flex flex-col items-center">
              {/* Camera Frame Container */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden bg-black border-2 border-white/20 shadow-inner">
                {/* HTML5 QR Code Mount Element */}
                <div id="qr-reader-container" className="w-full h-full"></div>

                {/* Corner guide markers */}
                <div className="pointer-events-none absolute inset-0 p-4 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-[#f06449] rounded-tl-lg"></div>
                    <div className="w-6 h-6 border-t-4 border-r-4 border-[#f06449] rounded-tr-lg"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-4 border-l-4 border-[#f06449] rounded-bl-lg"></div>
                    <div className="w-6 h-6 border-b-4 border-r-4 border-[#f06449] rounded-br-lg"></div>
                  </div>
                </div>

                {/* Animated Scanner Laser Bar */}
                <div className="pointer-events-none absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#f06449] to-transparent animate-pulse top-1/2"></div>
              </div>

              {/* Security Pill Indicators */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950 border border-white/10">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  GPS Geofencing Active
                </span>
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950 border border-white/10">
                  <Smartphone className="w-3 h-3 text-[#93c5fd]" />
                  Device Locked
                </span>
              </div>
            </div>
          )}

          {/* STATE 2: SUBMITTING / VALIDATING SPINNER */}
          {state === "submitting" && (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="relative mb-5">
                <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-[#f06449] animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Compass className="w-6 h-6 text-[#93c5fd] animate-pulse" />
                </div>
              </div>
              <h3 className="text-base font-bold text-white">Verifying Presence</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed font-sans">
                {submissionProgress}
              </p>
            </div>
          )}

          {/* STATE 3: SUCCESS FEEDBACK CARD */}
          {state === "success" && (
            <div className="py-8 w-full flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-950/40">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Check-In Confirmed
              </span>
              <h2 className="text-2xl font-black text-white mt-1">Attendance Recorded!</h2>

              {/* Verification Details Box */}
              <div className="w-full mt-5 p-4 rounded-2xl bg-slate-950/70 border border-white/10 text-left space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Course Code:</span>
                  <span className="font-bold text-white font-mono">{successData?.courseCode}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Verified Distance:</span>
                  <span className="font-bold text-emerald-400">
                    {successData?.distanceMeters != null ? `${successData.distanceMeters}m from teacher` : "Inside bounds"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="font-mono text-slate-300">
                    {successData?.timestamp ? new Date(successData.timestamp).toLocaleTimeString() : "Just now"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => router.push("/student/attendance")}
                className="w-full mt-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
              >
                View Attendance Ledger
              </button>
            </div>
          )}

          {/* STATE 4: ERROR FEEDBACK CARD */}
          {state === "error" && (
            <div className="py-8 w-full flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-4 shadow-lg shadow-rose-950/40">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Verification Rejected
              </span>
              <h2 className="text-xl font-bold text-white mt-1">Attendance Failed</h2>

              <div className="w-full mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs text-left leading-relaxed">
                {errorMessage || "Unable to verify attendance."}
              </div>

              <button
                onClick={handleRetry}
                className="w-full mt-6 py-3 rounded-2xl bg-[#f06449] hover:bg-[#d9533a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#f06449]/30 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Scan
              </button>
            </div>
          )}
        </div>

        {/* Back Link */}
        <button
          onClick={() => router.push("/student/dashboard")}
          className="mt-6 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </main>
    </div>
  );
}
