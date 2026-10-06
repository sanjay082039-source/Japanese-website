import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { action, studentId, deviceSessionId, deviceType, newPassword } = body;

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId parameter." }, { status: 400 });
    }

    if (action === "DEAUTHORIZE_DEVICE") {
      if (deviceSessionId) {
        await prisma.deviceSession.deleteMany({
          where: { id: deviceSessionId, userId: studentId },
        });
      } else if (deviceType) {
        await prisma.deviceSession.deleteMany({
          where: { userId: studentId, deviceType },
        });
      }
      return NextResponse.json({ success: true, message: `Device session revoked successfully.` });
    }

    if (action === "WIPE_ALL_SESSIONS") {
      await prisma.deviceSession.deleteMany({
        where: { userId: studentId },
      });
      return NextResponse.json({ success: true, message: "All active device sessions wiped and logged out." });
    }

    if (action === "RESET_PASSWORD") {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
      }
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      await prisma.user.update({
        where: { id: studentId },
        data: { passwordHash },
      });

      // Force terminate active sessions on password reset
      await prisma.deviceSession.deleteMany({
        where: { userId: studentId },
      });

      return NextResponse.json({ success: true, message: "Password updated and all sessions terminated." });
    }

    return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
  } catch (error: any) {
    console.error("Device management error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
