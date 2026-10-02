import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let body;
    // Support JSON or text beacon payload
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      body = JSON.parse(text);
    }

    const { examId, attemptId, violationType, details, severity = "WARNING" } = body;

    // Optional session fallback if beacon sends cookies
    const session = await getSessionFromRequest(request);
    const studentId = session?.id;

    if (!attemptId && (!examId || !studentId)) {
      return NextResponse.json({ error: "Insufficient telemetry identifiers" }, { status: 400 });
    }

    // Locate active attempt
    let activeAttempt;
    if (attemptId) {
      activeAttempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
      });
    } else if (examId && studentId) {
      activeAttempt = await prisma.examAttempt.findUnique({
        where: {
          examId_studentId: {
            examId,
            studentId,
          },
        },
      });
    }

    if (!activeAttempt) {
      return NextResponse.json({ error: "Active attempt not located" }, { status: 404 });
    }

    if (activeAttempt.status !== "IN_PROGRESS") {
      return NextResponse.json({ message: "Attempt already finalized" });
    }

    // Record violation in audit log
    await prisma.cheatViolationLog.create({
      data: {
        attemptId: activeAttempt.id,
        violationType: violationType || "UNKNOWN_INFRACTION",
        details: details || "Security shield triggered",
        severity,
        timestamp: new Date(),
      },
    });

    // Increment infraction counter
    const newCheatCount = activeAttempt.cheatCount + 1;
    const shouldDisqualify = newCheatCount >= 3;

    await prisma.examAttempt.update({
      where: { id: activeAttempt.id },
      data: {
        cheatCount: newCheatCount,
        ...(shouldDisqualify
          ? {
              status: "DISQUALIFIED",
              score: 0,
              submittedAt: new Date(),
            }
          : {}),
      },
    });

    return NextResponse.json({
      success: true,
      cheatCount: newCheatCount,
      disqualified: shouldDisqualify,
    });
  } catch (error: unknown) {
    console.error("Telemetry logging error:", error);
    return NextResponse.json({ error: "Log failed" }, { status: 500 });
  }
}
