import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Student authorization required to sit for examinations." },
        { status: 403 }
      );
    }

    const examId = params.id;
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Examination not found." }, { status: 404 });
    }

    if (!exam.isPublished) {
      return NextResponse.json(
        { error: "This examination has not yet been published by staff." },
        { status: 403 }
      );
    }

    // Level check
    if (exam.courseLevel !== session.courseLevel) {
      return NextResponse.json(
        { error: `This exam is designated for level ${exam.courseLevel}. Your enrolled level is ${session.courseLevel}.` },
        { status: 403 }
      );
    }

    const now = new Date();
    // Start/End Window check
    if (now < exam.startTime) {
      return NextResponse.json(
        { error: `Examination window has not commenced yet. Starts at ${exam.startTime.toLocaleString()}` },
        { status: 403 }
      );
    }

    if (now > exam.endTime) {
      return NextResponse.json(
        { error: `Examination deadline expired at ${exam.endTime.toLocaleString()}` },
        { status: 403 }
      );
    }

    // Check for existing attempt
    let attempt = await prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId: session.id,
        },
      },
      include: {
        violations: true,
      },
    });

    if (attempt) {
      if (attempt.status === "SUBMITTED" || attempt.status === "AUTO_SUBMITTED") {
        return NextResponse.json(
          { error: "You have already completed and submitted this examination.", attempt },
          { status: 400 }
        );
      }
      if (attempt.status === "DISQUALIFIED") {
        return NextResponse.json(
          { error: "This examination attempt was disqualified due to security infractions.", attempt },
          { status: 403 }
        );
      }
    } else {
      // Create new attempt
      attempt = await prisma.examAttempt.create({
        data: {
          examId,
          studentId: session.id,
          startedAt: now,
          status: "IN_PROGRESS",
          cheatCount: 0,
        },
        include: {
          violations: true,
        },
      });
    }

    // Hard Server-Synchronized Time-Drift Protection
    const startedAtTime = new Date(attempt.startedAt).getTime();
    const elapsedSeconds = Math.floor((now.getTime() - startedAtTime) / 1000);
    const totalAllowedSeconds = exam.durationMinutes * 60;
    const remainingSeconds = Math.max(0, totalAllowedSeconds - elapsedSeconds);

    // Auto-expire if elapsed > allowed + grace (60s)
    if (remainingSeconds <= 0 && attempt.status === "IN_PROGRESS") {
      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "AUTO_SUBMITTED",
          submittedAt: now,
        },
      });
      return NextResponse.json(
        { error: "Allotted examination time has expired. The session was auto-submitted." },
        { status: 410 }
      );
    }

    // CRITICAL SECURITY: Sanitize questions by stripping correctOption so the answers are never sent to the client!
    const sanitizedQuestions = exam.questions.map((q) => {
      let parsedOptions: string[] = [];
      try {
        parsedOptions = JSON.parse(q.optionsJson);
      } catch (e) {
        parsedOptions = [];
      }
      return {
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: parsedOptions,
        marks: q.marks,
        orderIndex: q.orderIndex,
      };
    });

    let proctoringRules = null;
    try {
      if (exam.proctoringRules) {
        proctoringRules = JSON.parse(exam.proctoringRules);
      }
    } catch (e) {
      proctoringRules = null;
    }

    return NextResponse.json({
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      serverTime: now.toISOString(),
      durationMinutes: exam.durationMinutes,
      remainingSeconds,
      proctoringRules,
      infractions: attempt.cheatCount,
      violations: attempt.violations,
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        courseLevel: exam.courseLevel,
        totalMarks: exam.totalMarks,
        questions: sanitizedQuestions,
      },
    });
  } catch (error: unknown) {
    console.error("Exam attempt init error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
