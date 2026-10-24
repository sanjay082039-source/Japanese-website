"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import Navbar from "@/components/navigation/Navbar";
import { UserSession } from "@/lib/types";
import {
  Camera,
  CameraOff,
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

type ScannerState = "init" | "idle" | "scanning" | "submitting" | "success" | "error";

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

  // Explicitly cut off all camera hardware tracks across the document
  const forceKillAllCameraTracks = useCallback(() => {
    if (typeof document === "undefined") return;

    try {
      const videos = document.querySelectorAll("video");
      videos.forEach((video) => {
        try {
          const stream = video.srcObject as MediaStream | null;
          if (stream && stream.getTracks) {
            stream.getTracks().forEach((track) => {
              track.stop();
              track.enabled = false;
            });
          }
          video.srcObject = null;
        } catch (e) {
          // ignore error on stream cleanup
        }
      });
    } catch (e) {
      // ignore
    }
  }, []);

  // Stop camera and ensure hardware release
  const stopCamera = useCallback(async () => {
    try {
      if (scannerRef.current) {
        if (hasStartedRef.current) {
          try {
            await scannerRef.current.stop();
          } catch (e) {
            console.warn("scanner stop warning:", e);
          }
        }
        try {
          scannerRef.current.clear();
        } catch (e) {
          console.warn("scanner clear warning:", e);
        }
      }
    } finally {
      hasStartedRef.current = false;
      scannerRef.current = null;
      forceKillAllCameraTracks();
    }
  }, [forceKillAllCameraTracks]);

  // 1. Authenticate user - do NOT auto-start camera; stay in "idle" state
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
        setState("idle"); // Scanner is closed by default, user must tap to open
      } catch (err) {
        setErrorMessage("Authentication failed. Please log in again.");
        setState("error");
      }
    }
    loadUser();
  }, [router]);

  // 2. Lifecycle listeners: kill camera when tab is minimized, switched, or navigated away
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden / phone locked: cut off camera access immediately!
        stopCamera();
        setState((prev) => (prev === "scanning" ? "idle" : prev));
      }
    };

    const handlePageHide = () => {
      stopCamera();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      stopCamera();
    };
  }, [stopCamera]);

  // 3. Initialize and start camera scanner only when state === "scanning"
  const startCamera = useCallback(async () => {
    if (typeof window === "undefined" || hasStartedRef.current) return;

    try {
      setErrorMessage(null);

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

      forceKillAllCameraTracks();
      setErrorMessage(
        "Camera access was denied or is unavailable. Please ensure camera permissions are allowed in your browser settings."
      );
      setState("error");
    }
  }, [forceKillAllCameraTracks]);

  useEffect(() => {
    if (state === "scanning" && user && !hasStartedRef.current) {
      startCamera();
    }
  }, [state, user, startCamera]);

  // User manually closes the scanner
  const handleCloseScanner = async () => {
    await stopCamera();
    setState("idle");
  };

  // User opens the scanner
  const handleOpenScanner = () => {
    setErrorMessage(null);
    setSuccessData(null);
    setState("scanning");
  };

  // User navigates back
  const handleBackToDashboard = async () => {
    await stopCamera();
    router.push("/student/dashboard");
  };

  // 4. Handle QR Code Detection
  const onQrCodeSuccess = async (decodedText: string) => {
    // Immediately cut off camera to lock viewfinder, preserve privacy, and save battery
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

  // 5. Submit to Check-In API
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
  };

  return (
    <div className="min-h-screen bg-japanese-canvas text-slate-100 flex flex-col justify-between selection:bg-[#e0533c] selection:text-white">
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
          {/* STATE 0: INIT / LOADING */}
          {state === "init" && (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-[#f06449] animate-spin mb-3"></div>
              <p className="text-xs text-slate-400">Loading scanner...</p>
            </div>
          )}

          {/* STATE 1: IDLE - CAMERA OFF / CLOSED */}
          {state === "idle" && (
            <div className="py-6 w-full flex flex-col items-center text-center animate-in fade-in duration-200">
              <div className="relative w-28 h-28 rounded-3xl bg-slate-950 border border-white/10 flex items-center justify-center mb-5 shadow-inner group">
                <CameraOff className="w-12 h-12 text-slate-500 group-hover:text-slate-400 transition-colors" />
                <span className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300 font-bold uppercase tracking-wider">
                  Camera Off
                </span>
              </div>

              <h2 className="text-lg font-bold text-white">Scanner is Closed</h2>
              <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                Camera access is cut off. Whenever you need to scan the attendance QR, tap the button below.
              </p>

              <button
                onClick={handleOpenScanner}
                className="w-full mt-6 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#f06449] to-[#ff7c62] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-[#f06449]/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Open Camera &amp; Scan QR
              </button>
            </div>
          )}

          {/* STATE 2: SCANNING VIEW */}
          {state === "scanning" && (
            <div className="w-full flex flex-col items-center animate-in fade-in duration-200">
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

              {/* Close Camera Button */}
              <button
                onClick={handleCloseScanner}
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CameraOff className="w-4 h-4 text-rose-400" />
                Close Scanner &amp; Cut Off Camera
              </button>

              {/* Security Pill Indicators */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
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

          {/* STATE 3: SUBMITTING / VALIDATING SPINNER */}
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

          {/* STATE 4: SUCCESS FEEDBACK CARD */}
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

          {/* STATE 5: ERROR FEEDBACK CARD */}
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

              <div className="flex flex-col sm:flex-row gap-3 w-full mt-6">
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3 rounded-2xl bg-[#f06449] hover:bg-[#d9533a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#f06449]/30 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={handleCloseScanner}
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-colors cursor-pointer"
                >
                  <CameraOff className="w-4 h-4" />
                  Close Camera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Back Link */}
        <button
          onClick={handleBackToDashboard}
          className="mt-6 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </main>
    </div>
  );
}
