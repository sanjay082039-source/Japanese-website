import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { FormAssignmentData, FormQuestion } from "@/lib/types";

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
      whereClause.courseLevel = session.courseLevel;
    } else if (courseLevel && courseLevel !== "ALL") {
      whereClause.courseLevel = courseLevel;
    }

    const rawAssignments = await prisma.assignment.findMany({
      where: whereClause,
      include: {
        submissions:
          session.role === "STUDENT"
            ? {
                where: { studentId: session.id },
              }
            : {
                include: {
                  student: {
                    select: { id: true, name: true, email: true, courseLevel: true, section: true },
                  },
                },
                orderBy: { submittedAt: "desc" },
              },
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Sanitize and structure assignments for Google Form format
    const assignments = rawAssignments.map((assign) => {
      let isGoogleForm = false;
      let formData: FormAssignmentData | null = null;

      try {
        if (assign.description && assign.description.trim().startsWith("{")) {
          const parsed = JSON.parse(assign.description);
          if (parsed && (parsed.formType === "GOOGLE_FORM" || Array.isArray(parsed.questions))) {
            isGoogleForm = true;
            formData = parsed;
          }
        }
      } catch {
        // Not a JSON form, standard legacy assignment
      }

      // Security measure: If user is a student and has NOT submitted yet,
      // redact the correctOption so answers cannot be inspected in browser DevTools
      if (isGoogleForm && formData && session.role === "STUDENT") {
        const studentSub = assign.submissions?.[0];
        const hasSubmitted = !!studentSub;

        if (!hasSubmitted && Array.isArray(formData.questions)) {
          const sanitizedQuestions = formData.questions.map((q: any) => {
            const { correctOption, ...rest } = q;
            return rest as FormQuestion;
          });
          formData = {
            ...formData,
            questions: sanitizedQuestions,
          };
        }
      }

      return {
        ...assign,
        isGoogleForm,
        formData,
      };
    });

    return NextResponse.json({ assignments });
  } catch (error: unknown) {
    console.error("Assignments fetch error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Assignment Creation (Staff) or Submission (Student)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // 1. Student Submission Flow
    if (session.role === "STUDENT") {
      const { assignmentId, content, answers, fileUrl } = body;
      if (!assignmentId) {
        return NextResponse.json(
          { error: "Assignment ID is required." },
          { status: 400 }
        );
      }

      // Check if assignment exists
      const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
      });

      if (!assignment) {
        return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
      }

      const isLate = new Date() > assignment.dueDate;
      let calculatedGrade: number | null = null;
      let submissionContent = content || "";

      // Check if this is a Google Form MCQ assignment and auto-grade
      try {
        if (assignment.description && assignment.description.trim().startsWith("{")) {
          const parsed = JSON.parse(assignment.description);
          if (parsed && Array.isArray(parsed.questions) && answers && typeof answers === "object") {
            let totalEarnedMarks = 0;
            const questionResults: Record<string, {
              questionText: string;
              selected: string | number;
              correct: string | number;
              marksEarned: number;
              maxMarks: number;
            }> = {};

            parsed.questions.forEach((q: FormQuestion) => {
              const studentAnswer = answers[q.id];
              const qMarks = Number(q.marks) || 1;
              const isCorrect = String(studentAnswer) === String(q.correctOption);

              const marksEarned = isCorrect ? qMarks : 0;
              totalEarnedMarks += marksEarned;

              questionResults[q.id] = {
                questionText: q.questionText,
                selected: studentAnswer !== undefined ? studentAnswer : "Unanswered",
                correct: q.correctOption !== undefined ? q.correctOption : "N/A",
                marksEarned,
                maxMarks: qMarks,
              };
            });

            calculatedGrade = totalEarnedMarks;
            submissionContent = JSON.stringify({
              answers,
              questionResults,
              score: totalEarnedMarks,
              maxMarks: assignment.maxMarks,
              submittedAt: new Date().toISOString(),
              textNote: content || "Google Form MCQ Submission Completed",
            });
          }
        }
      } catch (parseErr) {
        console.warn("Could not auto-grade assignment:", parseErr);
      }

      if (!submissionContent && !answers) {
        return NextResponse.json(
          { error: "Submission answers or written content is required." },
          { status: 400 }
        );
      }

      // Upsert submission
      const submission = await prisma.assignmentSubmission.upsert({
        where: {
          assignmentId_studentId: {
            assignmentId,
            studentId: session.id,
          },
        },
        update: {
          content: submissionContent,
          fileUrl: fileUrl || null,
          grade: calculatedGrade !== null ? calculatedGrade : undefined,
          submittedAt: new Date(),
          status: isLate ? "LATE" : "SUBMITTED",
        },
        create: {
          assignmentId,
          studentId: session.id,
          content: submissionContent,
          fileUrl: fileUrl || null,
          grade: calculatedGrade !== null ? calculatedGrade : null,
          submittedAt: new Date(),
          status: isLate ? "LATE" : "SUBMITTED",
        },
      });

      return NextResponse.json({
        success: true,
        submission,
        grade: calculatedGrade,
        maxMarks: assignment.maxMarks,
      });
    }

    // 2. Admin Assignment Publisher Flow
    if (session.role === "ADMIN") {
      const { title, description, instructions, courseLevel, dueDate, maxMarks, questions } = body;

      if (!title || !courseLevel || !dueDate) {
        return NextResponse.json(
          { error: "Title, course level, and due date are required." },
          { status: 400 }
        );
      }

      let finalDescription = description || "";
      let finalMaxMarks = parseInt(maxMarks || 100, 10);

      // If Google Form questions are provided
      if (Array.isArray(questions) && questions.length > 0) {
        // Validate and normalize questions
        const normalizedQuestions: FormQuestion[] = questions.map((q, idx) => ({
          id: q.id || `q_${idx + 1}_${Date.now()}`,
          questionText: q.questionText || `Question ${idx + 1}`,
          questionType: q.questionType || "MCQ",
          options: Array.isArray(q.options) && q.options.length > 0 ? q.options : ["Option 1", "Option 2"],
          correctOption: typeof q.correctOption === "number" ? q.correctOption : 0,
          marks: Number(q.marks) > 0 ? Number(q.marks) : 5, // admin sets mark for each question
        }));

        // Dynamically calculate total marks from sum of question marks
        const sumOfMarks = normalizedQuestions.reduce((acc, q) => acc + q.marks, 0);
        finalMaxMarks = sumOfMarks > 0 ? sumOfMarks : finalMaxMarks;

        const formData: FormAssignmentData = {
          formType: "GOOGLE_FORM",
          instructions: instructions || description || "Please answer all questions carefully.",
          questions: normalizedQuestions,
        };

        finalDescription = JSON.stringify(formData);
      }

      const assignment = await prisma.assignment.create({
        data: {
          title,
          description: finalDescription,
          courseLevel,
          dueDate: new Date(dueDate),
          maxMarks: finalMaxMarks,
          isPublished: true,
        },
      });

      return NextResponse.json({ success: true, assignment });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error: unknown) {
    console.error("Assignment action error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Assignment Deletion (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    await prisma.assignment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Assignment deleted successfully" });
  } catch (error: unknown) {
    console.error("Assignment delete error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Assignment or Submission Updating (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, grade, feedback, assignmentId, title, dueDate } = body;

    if (submissionId) {
      const updated = await prisma.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
          grade: grade !== undefined ? parseFloat(grade) : undefined,
          feedback: feedback !== undefined ? feedback : undefined,
          status: "GRADED",
        },
      });
      return NextResponse.json({ success: true, submission: updated });
    }

    if (assignmentId) {
      const updated = await prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          title: title || undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        },
      });
      return NextResponse.json({ success: true, assignment: updated });
    }

    return NextResponse.json({ error: "Missing submissionId or assignmentId" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Assignment update error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

