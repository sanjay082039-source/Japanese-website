import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET Chapters by level
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseLevel = searchParams.get("courseLevel") || session.courseLevel || "N5";

    const chapters = await prisma.chapter.findMany({
      where: { courseLevel },
      include: {
        progresses: {
          where: { studentId: session.id },
        },
      },
      orderBy: { chapterNumber: "asc" },
    });

    const formatted = chapters.map((c) => {
      const prog = c.progresses[0];
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        courseLevel: c.courseLevel,
        chapterNumber: c.chapterNumber,
        videoUrl: c.videoUrl,
        durationSeconds: c.durationSeconds,
        notesContent: c.notesContent,
        resources: c.resourcesJson ? JSON.parse(c.resourcesJson) : [],
        quizQuestions: c.quizQuestionsJson ? JSON.parse(c.quizQuestionsJson) : [],
        watchPercentage: prog?.watchPercentage || 0,
        videoCompleted: prog?.videoCompleted || false,
        quizSubmitted: prog?.quizSubmitted || false,
        quizScore: prog?.quizScore || null,
      };
    });

    return NextResponse.json({ chapters: formatted });
  } catch (error: any) {
    console.error("Chapters GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to load chapters" }, { status: 500 });
  }
}

// POST Create Chapter (Admin) or Update Watch/Quiz Progress (Student)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // 1. ADMIN CREATE CHAPTER
    if (action === "CREATE_CHAPTER") {
      if (session.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin role required." }, { status: 403 });
      }

      const {
        title,
        description,
        courseLevel,
        chapterNumber,
        videoUrl,
        durationSeconds,
        notesContent,
        resources,
        quizQuestions,
      } = body;

      const newChapter = await prisma.chapter.create({
        data: {
          title,
          description,
          courseLevel,
          chapterNumber: parseInt(chapterNumber, 10) || 1,
          videoUrl,
          durationSeconds: parseInt(durationSeconds, 10) || 600,
          notesContent: notesContent || "",
          resourcesJson: resources ? JSON.stringify(resources) : null,
          quizQuestionsJson: quizQuestions ? JSON.stringify(quizQuestions) : null,
        },
      });

      return NextResponse.json({ success: true, chapter: newChapter });
    }

    // 2. STUDENT VIDEO PROGRESS SYNC
    if (action === "UPDATE_VIDEO_PROGRESS") {
      const { chapterId, watchPercentage } = body;
      if (!chapterId) {
        return NextResponse.json({ error: "chapterId is required." }, { status: 400 });
      }

      const pct = Math.min(100, Math.max(0, Number(watchPercentage) || 0));
      const isCompleted = pct >= 99.5; // Strictly reached 100%

      const updated = await prisma.chapterProgress.upsert({
        where: {
          studentId_chapterId: {
            studentId: session.id,
            chapterId,
          },
        },
        create: {
          studentId: session.id,
          chapterId,
          watchPercentage: pct,
          videoCompleted: isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
        update: {
          // Disallow rolling backwards
          watchPercentage: pct,
          videoCompleted: isCompleted ? true : undefined,
          completedAt: isCompleted ? new Date() : undefined,
        },
      });

      return NextResponse.json({
        success: true,
        watchPercentage: updated.watchPercentage,
        videoCompleted: updated.videoCompleted,
      });
    }

    // 3. STUDENT SUBMIT GATED QUIZ
    if (action === "SUBMIT_CHAPTER_QUIZ") {
      const { chapterId, answers } = body;
      if (!chapterId || !answers) {
        return NextResponse.json({ error: "chapterId and answers are required." }, { status: 400 });
      }

      // Verify video gate has completed
      const progress = await prisma.chapterProgress.findUnique({
        where: {
          studentId_chapterId: {
            studentId: session.id,
            chapterId,
          },
        },
      });

      if (!progress || !progress.videoCompleted) {
        return NextResponse.json(
          { error: "Forbidden: You must complete watching 100% of the lecture video before unlocking the quiz." },
          { status: 403 }
        );
      }

      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
      });

      if (!chapter || !chapter.quizQuestionsJson) {
        return NextResponse.json({ error: "No quiz associated with this chapter." }, { status: 400 });
      }

      const questions: any[] = JSON.parse(chapter.quizQuestionsJson);
      let correctCount = 0;

      questions.forEach((q) => {
        const studentAns = answers[q.id];
        if (studentAns !== undefined && Number(studentAns) === Number(q.correctOption)) {
          correctCount++;
        }
      });

      const score = Number(((correctCount / Math.max(1, questions.length)) * 100).toFixed(1));

      const updated = await prisma.chapterProgress.update({
        where: {
          studentId_chapterId: {
            studentId: session.id,
            chapterId,
          },
        },
        data: {
          quizSubmitted: true,
          quizScore: score,
          quizAnswersJson: JSON.stringify(answers),
        },
      });

      return NextResponse.json({
        success: true,
        score,
        totalQuestions: questions.length,
        correctCount,
        message: `Quiz submitted successfully! Score: ${score}%`,
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("Chapter error:", error);
    return NextResponse.json({ error: error.message || "Chapter operation failed" }, { status: 500 });
  }
}
