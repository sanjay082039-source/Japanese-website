import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator privilege required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get("examId");

    const whereClause: Record<string, unknown> = {};
    if (examId && examId !== "ALL") {
      whereClause.examId = examId;
    }

    const attempts = await prisma.examAttempt.findMany({
      where: whereClause,
      include: {
        student: {
          select: { id: true, name: true, email: true, courseLevel: true, section: true, phone: true },
        },
        exam: {
          include: {
            questions: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        violations: {
          orderBy: { timestamp: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ attempts });
  } catch (error: unknown) {
    console.error("Attempts fetch error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
