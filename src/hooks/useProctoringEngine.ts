"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ProctoringRules, ViolationEvent } from "@/lib/types";

interface UseProctoringOptions {
  examId: string;
  attemptId?: string;
  rules?: Partial<ProctoringRules>;
  maxInfractions?: number;
  isActive?: boolean;
  onDisqualify?: (reason: string, violations: ViolationEvent[]) => void;
  onAutoSubmit?: (reason: string) => void;
  onViolation?: (violation: ViolationEvent, totalCount: number) => void;
}

export function useProctoringEngine({
  examId,
  attemptId,
  rules = {
    clipboardBlock: true,
    devtoolsBlock: true,
    tabSwitchLimit: 3,
    fullScreenRequired: true,
    selectionBlock: true,
  },
  maxInfractions = 3,
  isActive = true,
  onDisqualify,
  onAutoSubmit,
  onViolation,
}: UseProctoringOptions) {
  const [violationCount, setViolationCount] = useState<number>(0);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);

  // Use refs to prevent stale closures inside event listeners
  const violationCountRef = useRef<number>(0);
  const isDisqualifiedRef = useRef<boolean>(false);
  const maxInfractionsRef = useRef<number>(maxInfractions);
  const examIdRef = useRef<string>(examId);
  const attemptIdRef = useRef<string | undefined>(attemptId);
  const hasEnteredFullscreenRef = useRef<boolean>(false);

  violationCountRef.current = violationCount;
  isDisqualifiedRef.current = isDisqualified;
  maxInfractionsRef.current = maxInfractions;
  examIdRef.current = examId;
  attemptIdRef.current = attemptId;

  // Initialize fullscreen state on mount
  useEffect(() => {
    if (typeof document !== "undefined") {
      const inFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(inFullscreen);
      if (inFullscreen) {
        hasEnteredFullscreenRef.current = true;
      }
    }
  }, []);

  // Background Telemetry Dispatch to Server
  const logTelemetryToServer = useCallback((event: ViolationEvent) => {
    try {
      const payload = JSON.stringify({
        examId: examIdRef.current,
        attemptId: attemptIdRef.current,
        violationType: event.type,
        details: event.details,
        severity: event.severity,
        timestamp: event.timestamp,
      });

      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/exams/log-violation", blob);
      } else {
        fetch("/api/exams/log-violation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch((err) => console.error("Telemetry report failed:", err));
      }
    } catch (err) {
      console.error("Telemetry failed:", err);
    }
  }, []);

  // Violation Registry State Machine
  const recordViolation = useCallback(
    (type: ViolationEvent["type"], details: string, severity: ViolationEvent["severity"] = "WARNING") => {
      if (!isActive || isDisqualifiedRef.current) return;

      const newViolation: ViolationEvent = {
        type,
        details,
        severity,
        timestamp: new Date().toISOString(),
      };

      const updatedCount = violationCountRef.current + 1;
      setViolationCount(updatedCount);
      setViolations((prev) => [...prev, newViolation]);
      setLastWarning(details);

      // Trigger telemetry ping
      logTelemetryToServer(newViolation);

      if (onViolation) {
        onViolation(newViolation, updatedCount);
      }

      // Check violation threshold
      if (updatedCount >= maxInfractionsRef.current) {
        setIsDisqualified(true);
        isDisqualifiedRef.current = true;
        const reason = `Maximum security infractions reached (${updatedCount}/${maxInfractionsRef.current}). Attempt disqualified.`;

        if (onDisqualify) {
          onDisqualify(reason, [...violations, newViolation]);
        }
        if (onAutoSubmit) {
          onAutoSubmit(reason);
        }
      }
    },
    [isActive, logTelemetryToServer, onViolation, onDisqualify, onAutoSubmit, violations]
  );

  // Fullscreen Management
  const requestFullScreen = useCallback(async () => {
    try {
      if (typeof document !== "undefined" && document.documentElement && !document.fullscreenElement) {
        const el = document.documentElement as unknown as {
          requestFullscreen?: () => Promise<void>;
          webkitRequestFullscreen?: () => Promise<void>;
          msRequestFullscreen?: () => Promise<void>;
        };
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen();
        }
        setIsFullscreen(true);
        hasEnteredFullscreenRef.current = true;
      }
    } catch (err) {
      console.warn("Fullscreen request declined or failed:", err);
    }
  }, []);

  const exitFullScreen = useCallback(async () => {
    try {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        const doc = document as unknown as {
          exitFullscreen?: () => Promise<void>;
          webkitExitFullscreen?: () => Promise<void>;
          msExitFullscreen?: () => Promise<void>;
        };
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn("Exit fullscreen failed:", err);
    }
  }, []);

  // Setup Global Event Listeners & Security Shield
  useEffect(() => {
    if (!isActive) return;

    // 1. User Selection & Context Menu Blocking
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordViolation("CLIPBOARD_COPY", "Attempted to open right-click context menu.", "INFO");
      return false;
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (rules.clipboardBlock) {
        e.preventDefault();
        recordViolation("CLIPBOARD_COPY", "Unauthorized copy operation blocked.", "WARNING");
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      if (rules.clipboardBlock) {
        e.preventDefault();
        recordViolation("CLIPBOARD_COPY", "Unauthorized cut operation blocked.", "WARNING");
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (rules.clipboardBlock) {
        e.preventDefault();
        recordViolation("CLIPBOARD_PASTE", "Unauthorized paste operation intercepted.", "WARNING");
      }
    };

    // 2. DevTools & Keyboard Shortcut Shield
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!rules.devtoolsBlock) return;

      const isMac = typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // F12 (DevTools)
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        recordViolation("DEVTOOLS_ATTEMPT", "Blocked attempt to open Developer Tools (F12).", "CRITICAL");
        return;
      }

      // Ctrl+Shift+I / Ctrl+Shift+J (DevTools Inspector / Console)
      if (cmdOrCtrl && e.shiftKey && (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) {
        e.preventDefault();
        e.stopPropagation();
        recordViolation("DEVTOOLS_ATTEMPT", "Blocked DevTools shortcut (Ctrl+Shift+I/J).", "CRITICAL");
        return;
      }

      // Ctrl+Shift+C (Inspect Element)
      if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        e.stopPropagation();
        recordViolation("DEVTOOLS_ATTEMPT", "Blocked Inspect Element shortcut (Ctrl+Shift+C).", "CRITICAL");
        return;
      }

      // Ctrl+U (View Page Source)
      if (cmdOrCtrl && e.key.toLowerCase() === "u") {
        e.preventDefault();
        e.stopPropagation();
        recordViolation("DEVTOOLS_ATTEMPT", "Blocked Page Source view (Ctrl+U).", "WARNING");
        return;
      }

      // Ctrl+S / Ctrl+P (Save / Print Page)
      if (cmdOrCtrl && (e.key.toLowerCase() === "s" || e.key.toLowerCase() === "p")) {
        e.preventDefault();
        e.stopPropagation();
        recordViolation("CLIPBOARD_COPY", "Blocked Save/Print dialog command.", "WARNING");
        return;
      }

      // Ctrl+C / Ctrl+V / Ctrl+X
      if (rules.clipboardBlock && cmdOrCtrl && ["c", "v", "x"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
        recordViolation(
          e.key.toLowerCase() === "v" ? "CLIPBOARD_PASTE" : "CLIPBOARD_COPY",
          `Blocked shortcut clipboard command (Ctrl+${e.key.toUpperCase()}).`,
          "WARNING"
        );
        return;
      }
    };

    // 3. Tab & Focus Switching Tracker (visibilitychange & window.onblur)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation(
          "TAB_SWITCH",
          "Student switched tabs or minimized exam window.",
          "CRITICAL"
        );
      }
    };

    const handleWindowBlur = () => {
      recordViolation(
        "WINDOW_BLUR",
        "Student navigated away from browser viewport or lost application focus.",
        "WARNING"
      );
    };

    // 4. Fullscreen State Tracker
    const handleFullscreenChange = () => {
      const doc = typeof document !== "undefined" ? (document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      }) : {};
      const active = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(active);
      if (active) {
        hasEnteredFullscreenRef.current = true;
      } else if (rules.fullScreenRequired && hasEnteredFullscreenRef.current) {
        recordViolation(
          "FULLSCREEN_EXIT",
          "Critical Violation: Exited Fullscreen mode during timed exam.",
          "CRITICAL"
        );
      }
    };

    // Attach security listeners
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("copy", handleCopy);
    window.addEventListener("cut", handleCut);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Apply strict CSS user-select none to body
    if (rules.selectionBlock) {
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
    }

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("cut", handleCut);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);

      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    };
  }, [isActive, recordViolation, rules]);

  return {
    violationCount,
    violations,
    isFullscreen,
    lastWarning,
    isDisqualified,
    infractionsRemaining: Math.max(0, maxInfractions - violationCount),
    requestFullScreen,
    exitFullScreen,
    clearWarning: () => setLastWarning(null),
    recordViolation,
  };
}
