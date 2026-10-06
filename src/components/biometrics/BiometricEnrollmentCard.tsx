"use client";

import React, { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";

interface BiometricEnrollmentCardProps {
  initialEnrolled?: boolean;
}

export const BiometricEnrollmentCard: React.FC<BiometricEnrollmentCardProps> = ({
  initialEnrolled = false,
}) => {
  const [isEnrolled, setIsEnrolled] = useState(initialEnrolled);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleEnroll = async () => {
    setLoading(true);
    setStatusMsg("");
    setErrorMsg("");

    try {
      // 1. Fetch WebAuthn registration options from server
      const optRes = await fetch("/api/biometrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REGISTER_OPTIONS" }),
      });

      if (!optRes.ok) {
        const err = await optRes.json();
        throw new Error(err.error || "Failed to initialize biometric enrollment");
      }

      const options = await optRes.json();
      setStatusMsg("Touch your device's fingerprint sensor or passkey reader now...");

      // 2. Prompt device authenticator (Touch ID, Windows Hello, Android Biometric)
      const regResponse = await startRegistration({ optionsJSON: options });

      // 3. Send response back to server for cryptographic validation
      setStatusMsg("Validating biometric key with server...");
      const verifyRes = await fetch("/api/biometrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REGISTER_VERIFY",
          response: regResponse,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Biometric verification failed.");
      }

      setIsEnrolled(true);
      setStatusMsg("Biometric hardware enrolled! You can now verify in live class kiosks.");
    } catch (err: any) {
      console.error("Biometric enrollment error:", err);
      setErrorMsg(err.message || "Failed to enroll biometric hardware.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#296ec2] to-[#0f294d] border border-[#93c5fd]/30 flex items-center justify-center shrink-0 shadow-md">
          <Fingerprint className="w-6 h-6 text-[#93c5fd]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-white">
              Hardware Biometric Authenticator (FIDO2 / Touch ID)
            </h3>
            {isEnrolled ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Enrolled
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                Not Enrolled
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Bind your laptop or phone&apos;s physical biometric sensor (Touch ID, Windows Hello, Android Fingerprint). Required for instant verification in the instructor&apos;s live roll-call kiosk.
          </p>
          {statusMsg && <p className="text-xs text-emerald-400 mt-1.5 font-medium">{statusMsg}</p>}
          {errorMsg && <p className="text-xs text-rose-400 mt-1.5 font-medium">{errorMsg}</p>}
        </div>
      </div>

      <div className="shrink-0">
        <button
          onClick={handleEnroll}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-[#296ec2] hover:bg-[#1b4987] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#081220]/60 transition-all cursor-pointer"
        >
          <Fingerprint className="w-4 h-4" />
          {loading ? "Waiting for sensor..." : isEnrolled ? "Re-enroll Authenticator" : "Enroll Biometrics Now"}
        </button>
      </div>
    </div>
  );
};
