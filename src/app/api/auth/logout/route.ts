import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (session?.deviceSessionId) {
      await prisma.deviceSession.deleteMany({
        where: { id: session.deviceSessionId },
      });
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    response.cookies.delete("rit_session");
    return response;
  } catch (error) {
    const response = NextResponse.json({ success: true, message: "Logged out" });
    response.cookies.delete("rit_session");
    return response;
  }
}
