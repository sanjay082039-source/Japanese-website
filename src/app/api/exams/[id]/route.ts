import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const exam = await prisma.exam.findUnique({
      where: { id: params.id },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
        attempts: {
          include: {
            student: {
              select: { id: true, name: true, email: true, courseLevel: true, section: true },
            },
            violations: true,
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // If student, filter out other attempts and strip correctOption
    if (session.role === "STUDENT") {
      const studentAttempt = exam.attempts.find((a) => a.studentId === session.id);
      const isCompleted =
        studentAttempt &&
        (studentAttempt.status === "SUBMITTED" ||
          studentAttempt.status === "AUTO_SUBMITTED" ||
          studentAttempt.status === "DISQUALIFIED");

      const sanitizedQuestions = exam.questions.map((q) => {
        let options: string[] = [];
        try {
          options = JSON.parse(q.optionsJson);
        } catch {
          options = [];
        }

        return {
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          options,
          marks: q.marks,
          orderIndex: q.orderIndex,
          // Only show correct answer if exam is completed
          ...(isCompleted ? { correctOption: q.correctOption } : {}),
        };
      });

      return NextResponse.json({
        exam: {
          ...exam,
          questions: sanitizedQuestions,
          attempts: studentAttempt ? [studentAttempt] : [],
        },
      });
    }

    // For Staff / Admin: return full exam details with all attempts and answers
    return NextResponse.json({ exam });
  } catch (error: unknown) {
    console.error("Exam detail error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Exam Submission
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const examId = params.id;
    const body = await request.json();
    const { answers = {}, isAutoSubmit = false, isDisqualified = false, reason = "" } = body;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId: session.id,
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "No active examination attempt record found." },
        { status: 400 }
      );
    }

    if (attempt.status === "SUBMITTED" || attempt.status === "AUTO_SUBMITTED") {
      return NextResponse.json(
        { error: "Examination has already been submitted." },
        { status: 400 }
      );
    }

    const now = new Date();
    const startedAt = new Date(attempt.startedAt).getTime();
    const allowedTimeMs = (exam.durationMinutes * 60 + 90) * 1000; // 90 seconds network latency grace period
    const isLate = now.getTime() - startedAt > allowedTimeMs;

    // Automatic evaluation of MCQ answers
    let calculatedScore = 0;
    let totalPossible = 0;

    exam.questions.forEach((q) => {
      totalPossible += q.marks;
      const studentAnswer = answers[q.id];

      if (q.questionType === "MCQ") {
        if (studentAnswer !== undefined && String(studentAnswer) === String(q.correctOption)) {
          calculatedScore += q.marks;
        }
      } else {
        // Subjective questions default to basic score if answered or 0 until manual staff grading
        if (studentAnswer && String(studentAnswer).trim().length > 0) {
          calculatedScore += Math.floor(q.marks * 0.7); // Initial provisional mark
        }
      }
    });

    const finalStatus = isDisqualified
      ? "DISQUALIFIED"
      : isAutoSubmit || isLate
      ? "AUTO_SUBMITTED"
      : "SUBMITTED";

    const finalScore = isDisqualified ? 0 : Number(calculatedScore.toFixed(1));

    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        status: finalStatus,
        submittedAt: now,
        score: finalScore,
        answersJson: JSON.stringify(answers),
        cheatLogJson: JSON.stringify({
          submissionReason: reason || (isAutoSubmit ? "Time Expired" : "Normal Submission"),
          finalStatus,
          submittedAt: now.toISOString(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      score: finalScore,
      totalPossible,
      status: finalStatus,
      submittedAt: updatedAttempt.submittedAt,
    });
  } catch (error: unknown) {
    console.error("Exam submit error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
