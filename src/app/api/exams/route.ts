import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseLevel = searchParams.get("courseLevel");

    const whereClause: Record<string, unknown> = {};

    if (session.role === "STUDENT") {
      // Students can only see published exams matching their level
      whereClause.courseLevel = session.courseLevel;
      whereClause.isPublished = true;
    } else if (courseLevel && courseLevel !== "ALL") {
      whereClause.courseLevel = courseLevel;
    }

    const exams = await prisma.exam.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { questions: true, attempts: true },
        },
        attempts: session.role === "STUDENT" ? {
          where: { studentId: session.id },
        } : false,
      },
      orderBy: { startTime: "desc" },
    });

    return NextResponse.json({ exams });
  } catch (error: unknown) {
    console.error("Exams fetch error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator privilege required" }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      courseLevel,
      startTime,
      endTime,
      durationMinutes,
      totalMarks,
      passingMarks = 50,
      isPublished = true,
      proctoringRules,
      questions = [],
    } = body;

    if (!title || !courseLevel || !startTime || !endTime || !durationMinutes) {
      return NextResponse.json(
        { error: "Missing required examination configuration fields" },
        { status: 400 }
      );
    }

    const newExam = await prisma.exam.create({
      data: {
        title,
        description,
        courseLevel,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        durationMinutes: parseInt(durationMinutes, 10),
        totalMarks: parseInt(totalMarks || 100, 10),
        passingMarks: parseInt(passingMarks, 10),
        isPublished: Boolean(isPublished),
        proctoringRules: JSON.stringify(
          proctoringRules || {
            clipboardBlock: true,
            devtoolsBlock: true,
            tabSwitchLimit: 3,
            fullScreenRequired: true,
            selectionBlock: true,
          }
        ),
        questions: {
          create: questions.map((q: { questionText: string; questionType?: string; options?: string[]; correctOption: string; marks?: number }, idx: number) => ({
            questionText: q.questionText,
            questionType: q.questionType || "MCQ",
            optionsJson: JSON.stringify(q.options || []),
            correctOption: String(q.correctOption),
            marks: q.marks || 1,
            orderIndex: idx,
          })),
        },
      },
      include: {
        questions: true,
      },
    });

    return NextResponse.json({ success: true, exam: newExam });
  } catch (error: unknown) {
    console.error("Exam creation error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
