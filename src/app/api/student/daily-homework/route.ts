import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getGeminiClient, AI_MODELS } from "@/lib/gemini";
import { getFallbackQuestionsForLevel, HomeworkQuestion } from "@/lib/homeworkQuestionBank";

export const dynamic = "force-dynamic";

// GET Student's Daily Homework (Generates a 15-question proctored homework unique to today)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Look for existing daily homework for this student today
    let assignment = await prisma.assignment.findFirst({
      where: {
        studentId: session.id,
        createdAt: { gte: today },
      },
      include: {
        submissions: {
          where: { studentId: session.id },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let needsRegen = false;
    if (assignment && assignment.questionsJson) {
      try {
        const parsed = JSON.parse(assignment.questionsJson);
        if (!Array.isArray(parsed) || parsed.length < 15) {
          needsRegen = true;
        }
      } catch {
        needsRegen = true;
      }
    }

    if (!assignment || needsRegen) {
      // Generate a dynamic anti-collusion homework with 15 questions unique to this student
      const gemini = getGeminiClient();
      let uniqueQuestions: HomeworkQuestion[] = [];

      if (gemini) {
        const prompt = `Generate exactly 15 unique, challenging JLPT ${session.courseLevel} practice exercises for a student named ${session.name}.
Include:
- 3 Kanji readings and orthography questions
- 3 Vocabulary and collocation questions
- 4 Grammar patterns and conjugations questions
- 3 Particle nuance questions
- 2 Short reading comprehension / contextual interpretation questions

Return ONLY a valid JSON array of 15 objects formatted as:
[
  {
    "id": "q1",
    "category": "KANJI",
    "questionText": "Authentic Japanese question prompt tailored for JLPT ${session.courseLevel}",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOption": 0,
    "explanation": "Linguistic and grammatical explanation of the correct choice",
    "marks": 2
  }
]`;
        try {
          const res = await gemini.models.generateContent({
            model: AI_MODELS.FLASH,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              responseMimeType: "application/json",
              temperature: 0.8, // High entropy for anti-collusion uniqueness
            },
          });
          const parsed = JSON.parse(res.text || "[]");
          if (Array.isArray(parsed) && parsed.length === 15) {
            uniqueQuestions = parsed;
          }
        } catch (e) {
          console.error("AI homework generation error:", e);
        }
      }

      if (uniqueQuestions.length < 15) {
        // Fallback to comprehensive 15-question bank salted uniquely with student ID
        const idHash = session.id.slice(-4);
        uniqueQuestions = getFallbackQuestionsForLevel(session.courseLevel, idHash);
      }

      const dueDate = new Date();
      dueDate.setHours(23, 59, 59, 999);

      if (assignment) {
        // Update existing incomplete assignment with the 15 questions
        assignment = await prisma.assignment.update({
          where: { id: assignment.id },
          data: {
            title: `Daily Proctored Homework (15 Questions) - ${session.name}`,
            description: `Official 15-Question Proctored Practicum for JLPT ${session.courseLevel}. Timed & anti-cheat protected.`,
            maxMarks: 30,
            questionsJson: JSON.stringify(uniqueQuestions),
          },
          include: {
            submissions: { where: { studentId: session.id } },
          },
        });
      } else {
        assignment = await prisma.assignment.create({
          data: {
            title: `Daily Proctored Homework (15 Questions) - ${session.name}`,
            description: `Official 15-Question Proctored Practicum for JLPT ${session.courseLevel}. Timed & anti-cheat protected.`,
            courseLevel: session.courseLevel,
            dueDate,
            maxMarks: 30,
            isPublished: true,
            isUniqueAiGenerated: true,
            studentId: session.id,
            questionsJson: JSON.stringify(uniqueQuestions),
          },
          include: {
            submissions: true,
          },
        });
      }
    }

    const questions: any[] = assignment.questionsJson ? JSON.parse(assignment.questionsJson) : [];
    const submission = assignment.submissions[0];

    // Redact correct options if not yet submitted
    const sanitizedQuestions = questions.map((q: any) => ({
      id: q.id,
      category: q.category || "GENERAL",
      questionText: q.questionText,
      options: q.options,
      marks: q.marks || 2,
      // Only reveal correctOption and explanation after submission
      correctOption: submission ? q.correctOption : undefined,
      explanation: submission ? q.explanation : undefined,
    }));

    return NextResponse.json({
      homework: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        courseLevel: assignment.courseLevel,
        dueDate: assignment.dueDate,
        maxMarks: assignment.maxMarks || 30,
        durationMinutes: 25, // 25-minute timed proctored window
        proctoringRules: {
          fullScreenRequired: true,
          tabSwitchLimit: 3,
          clipboardBlock: true,
          selectionBlock: true,
          devtoolsBlock: true,
        },
        questions: sanitizedQuestions,
        isSubmitted: !!submission,
        grade: submission?.grade ?? null,
        feedback: submission?.feedback ?? null,
        submittedAt: submission?.submittedAt ?? null,
      },
    });
  } catch (error: any) {
    console.error("Daily homework GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to load homework." }, { status: 500 });
  }
}

// POST Student Submit Daily Homework with Proctoring Telemetry
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { assignmentId, answers, cheatCount = 0, violations = [], timeSpentSeconds = 0 } = body;

    if (!assignmentId || !answers) {
      return NextResponse.json({ error: "assignmentId and answers required." }, { status: 400 });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment || !assignment.questionsJson) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    const questions: any[] = JSON.parse(assignment.questionsJson);
    let earnedMarks = 0;
    let totalMarks = 0;

    questions.forEach((q) => {
      const qMarks = q.marks || 2;
      totalMarks += qMarks;
      if (answers[q.id] !== undefined && Number(answers[q.id]) === Number(q.correctOption)) {
        earnedMarks += qMarks;
      }
    });

    const scorePercentage = Number(((earnedMarks / Math.max(1, totalMarks)) * 100).toFixed(1));

    let feedback = scorePercentage >= 80
      ? "素晴らしい！ (Outstanding mastery across all 15 JLPT competency areas!)"
      : scorePercentage >= 60
      ? "合格基準クリア (Passed JLPT benchmark. Review marked questions for further refinement.)"
      : "復習が必要です (Review your incorrect answers and nuance explanations to strengthen retention.)";

    if (cheatCount > 0) {
      feedback += ` [Security Audit: ${cheatCount} proctoring anomaly/tab-switch alert(s) logged during session]`;
    }

    const submissionPayload = {
      answers,
      cheatCount,
      violations,
      timeSpentSeconds,
      submittedAt: new Date().toISOString(),
    };

    const submission = await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: assignment.id,
          studentId: session.id,
        },
      },
      create: {
        assignmentId: assignment.id,
        studentId: session.id,
        content: JSON.stringify(submissionPayload),
        grade: scorePercentage,
        status: "GRADED",
        feedback,
      },
      update: {
        content: JSON.stringify(submissionPayload),
        grade: scorePercentage,
        status: "GRADED",
        feedback,
      },
    });

    return NextResponse.json({
      success: true,
      grade: scorePercentage,
      earnedMarks,
      totalMarks,
      cheatCount,
      feedback: submission.feedback,
      message: `Daily homework evaluated: ${earnedMarks}/${totalMarks} marks (${scorePercentage}%) with ${cheatCount} proctoring alert(s).`,
    });
  } catch (error: any) {
    console.error("Daily homework submit error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit homework." }, { status: 500 });
  }
}
