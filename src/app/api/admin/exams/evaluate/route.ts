import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Administrator privilege required to evaluate attempts." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { attemptId, score, status = "GRADED", evaluatorFeedback = "" } = body;

    if (!attemptId) {
      return NextResponse.json({ error: "Missing attempt ID." }, { status: 400 });
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true, student: true },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt record not located." }, { status: 404 });
    }

    const parsedScore = parseFloat(score);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > attempt.exam.totalMarks) {
      return NextResponse.json(
        { error: `Score must be a number between 0 and total marks (${attempt.exam.totalMarks}).` },
        { status: 400 }
      );
    }

    // Merge evaluator audit notes
    let existingLog: Record<string, unknown> = {};
    try {
      if (attempt.cheatLogJson) existingLog = JSON.parse(attempt.cheatLogJson);
    } catch {
      existingLog = {};
    }

    existingLog.evaluator = {
      evaluatedBy: session.name,
      evaluatorId: session.id,
      evaluatedAt: new Date().toISOString(),
      evaluatorFeedback,
      awardedScore: parsedScore,
      maxPossibleMarks: attempt.exam.totalMarks,
    };

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        score: parsedScore,
        status: status || "GRADED",
        cheatLogJson: JSON.stringify(existingLog),
      },
      include: {
        exam: true,
        student: {
          select: { id: true, name: true, email: true, courseLevel: true, section: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Candidate attempt evaluated and score updated successfully.",
      attempt: updated,
    });
  } catch (error: unknown) {
    console.error("Exam evaluation error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
