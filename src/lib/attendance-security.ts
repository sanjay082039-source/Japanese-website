import crypto from "crypto";

/**
 * Generates an HMAC-SHA256 time-decay token tied to a 5-second rotation window.
 * Tokens expire automatically, defeating photo sharing and static links.
 */
export function generateDynamicToken(
  sessionId: string,
  secretKey: string,
  timeWindow?: number
): string {
  const window = timeWindow ?? Math.floor(Date.now() / 5000);
  const payload = `${sessionId}:${window}`;
  return crypto
    .createHmac("sha256", secretKey)
    .update(payload)
    .digest("hex")
    .substring(0, 16);
}

/**
 * Verifies a dynamic token against current and previous 5s time windows (~8-10s grace).
 */
export function verifyDynamicToken(
  sessionId: string,
  secretKey: string,
  token: string
): boolean {
  const currentWindow = Math.floor(Date.now() / 5000);
  const validCurrent = generateDynamicToken(sessionId, secretKey, currentWindow);
  const validPrevious = generateDynamicToken(sessionId, secretKey, currentWindow - 1);
  return token === validCurrent || token === validPrevious;
}

/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
