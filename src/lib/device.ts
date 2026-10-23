import { NextRequest } from "next/server";

export type DeviceType = "MOBILE" | "DESKTOP";

/**
 * Categorize client request into strictly either MOBILE or DESKTOP.
 */
export function detectDeviceType(userAgentString?: string | null): DeviceType {
  if (!userAgentString) return "DESKTOP";

  const ua = userAgentString.toLowerCase();

  // Mobile patterns: phones, iPods, Android mobile browsers, iPhone
  const mobilePatterns = [
    /android.+mobile/,
    /iphone/,
    /ipod/,
    /windows phone/,
    /blackberry/,
    /bb10/,
    /mobile\/.+safari/,
    /opera mini/,
    /opera mobi/,
    /iemobile/,
  ];

  for (const pattern of mobilePatterns) {
    if (pattern.test(ua)) {
      return "MOBILE";
    }
  }

  // Tablets or laptops/desktops
  return "DESKTOP";
}

/**
 * Extract client IP address accurately from NextRequest headers
 */
export function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}
