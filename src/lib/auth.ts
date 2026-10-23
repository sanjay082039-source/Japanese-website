import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { UserSession, Role } from "./types";
import prisma from "./prisma";

const JWT_SECRET_STRING = process.env.JWT_SECRET || "rit-japanese-portal-secure-production-secret-2026";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET_STRING);
const COOKIE_NAME = "rit_session";

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: UserSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as UserSession;
  } catch (err) {
    return null;
  }
}

/**
 * Validates session cookie AND confirms database device session is still valid (not revoked by admin)
 */
export async function getSession(): Promise<UserSession | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const session = await verifySessionToken(token);
    if (!session) return null;

    // Check device session validity if student
    if (session.role === "STUDENT" && session.deviceSessionId) {
      const activeSession = await prisma.deviceSession.findUnique({
        where: { id: session.deviceSessionId },
      });
      if (!activeSession) {
        // Revoked by admin or expired
        return null;
      }
    }

    return session;
  } catch (error) {
    return null;
  }
}

export async function getSessionFromRequest(request: NextRequest): Promise<UserSession | null> {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const session = await verifySessionToken(token);
    if (!session) return null;

    if (session.role === "STUDENT" && session.deviceSessionId) {
      const activeSession = await prisma.deviceSession.findUnique({
        where: { id: session.deviceSessionId },
      });
      if (!activeSession) return null;
    }

    return session;
  } catch (error) {
    return null;
  }
}

export async function requireAuth(): Promise<UserSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized: Please log in to continue.");
  }
  return session;
}

export async function requireRole(allowedRoles: Role[]): Promise<UserSession> {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.role)) {
    throw new Error(`Forbidden: Insufficient privileges. Required: ${allowedRoles.join(", ")}`);
  }
  return session;
}

export function setSessionCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}
