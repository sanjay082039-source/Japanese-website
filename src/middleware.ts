import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET_STRING = process.env.JWT_SECRET || "rit-japanese-portal-secure-production-secret-2026";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET_STRING);
const COOKIE_NAME = "rit_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Retrieve auth session cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    const role = (payload as Record<string, unknown>).role as string;

    // Strict Two-Sided Portal Isolation:
    // 1. Admin Portal: Only ADMIN role
    if (pathname.startsWith("/admin")) {
      if (role !== "ADMIN") {
        return NextResponse.redirect(new URL("/student/dashboard", request.url));
      }
    }

    // 2. Student Portal: Only STUDENT role
    if (pathname.startsWith("/student")) {
      if (role !== "STUDENT") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", (payload as Record<string, unknown>).id as string);
    requestHeaders.set("x-user-role", role);
    requestHeaders.set("x-user-level", (payload as Record<string, unknown>).courseLevel as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (err) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Session expired or invalid" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));

    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*", "/api/admin/:path*", "/api/exams/:path*"],
};
