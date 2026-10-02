import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        courseLevel: true,
        section: true,
        phone: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ user: user || session });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch session profile" }, { status: 500 });
  }
}
