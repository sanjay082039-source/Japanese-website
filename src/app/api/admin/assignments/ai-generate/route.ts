import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getGeminiClient, AI_MODELS } from "@/lib/gemini";
import { FormQuestion, FormAssignmentData } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const GenerateAssignmentSchema = z.object({
  courseLevel: z.enum(["N1", "N2", "N3", "N4", "N5"]),
  focusArea: z.enum(["KANJI_VOCAB", "GRAMMAR", "READING_COMPREHENSION", "MIXED"]).default("MIXED"),
  questionCount: z.number().min(1).max(50).default(10),
  marksPerQuestion: z.number().min(1).max(20).default(5),
  dueDate: z.string().optional(),
  title: z.string().optional(),
  instructions: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
    }

    const rawBody = await request.json();
    const parsed = GenerateAssignmentSchema.parse(rawBody);

    const { courseLevel, focusArea, questionCount, marksPerQuestion, dueDate, title, instructions } = parsed;

    const assignmentTitle =
      title ||
      `Official JLPT ${courseLevel} ${focusArea.replace("_", " ")} Practice Assignment (${questionCount} Questions)`;

    const defaultInstructions =
      instructions ||
      `Complete all ${questionCount} proctored practice questions for JLPT ${courseLevel}. Clipboard copy/paste is strictly prohibited.`;

    let generatedQuestions: FormQuestion[] = [];

    const gemini = getGeminiClient();

    if (gemini) {
      const prompt = `Generate a rigorous, authentic JLPT ${courseLevel} assignment in JSON format.
Focus Area: ${focusArea}
Number of Questions: EXACTLY ${questionCount} questions.
Marks per Question: ${marksPerQuestion}

Return ONLY a valid JSON array of ${questionCount} objects conforming strictly to this format:
[
  {
    "id": "q_1",
    "questionText": "Authentic Japanese question prompt (with furigana in brackets if needed, or clear context)",
    "questionType": "MCQ",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctOption": 0, // 0-indexed number: 0, 1, 2, or 3
    "marks": ${marksPerQuestion}
  }
]`;

      try {
        const response = await gemini.models.generateContent({
          model: AI_MODELS.FLASH,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            systemInstruction:
              "You are a master Japanese Language Proficiency Test (JLPT) curriculum developer. Generate authentic, accurate multiple choice practice questions adhering strictly to the requested question count.",
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        });

        const text = response.text || "[]";
        const parsedJson = JSON.parse(text);
        if (Array.isArray(parsedJson) && parsedJson.length > 0) {
          generatedQuestions = parsedJson.map((q: any, idx: number) => ({
            id: `q_ai_${idx + 1}_${Date.now()}`,
            questionText: q.questionText || `Question ${idx + 1}`,
            questionType: "MCQ",
            options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ["Option 1", "Option 2", "Option 3", "Option 4"],
            correctOption: typeof q.correctOption === "number" ? q.correctOption : parseInt(q.correctOption || "0", 10),
            marks: Number(q.marks) || marksPerQuestion,
          }));
        }
      } catch (err) {
        console.error("Gemini assignment generation failed, falling back to curated bank:", err);
      }
    }

    // Fallback if AI produced fewer items than requested by Admin
    if (generatedQuestions.length < questionCount) {
      const needed = questionCount - generatedQuestions.length;
      const { getFallbackQuestionsForLevel } = await import("@/lib/homeworkQuestionBank");
      const bankItems = getFallbackQuestionsForLevel(courseLevel, "assign_" + Date.now().toString().slice(-4));

      let poolIndex = 0;
      for (let i = 0; i < needed; i++) {
        const sourceItem = bankItems[poolIndex % bankItems.length];
        generatedQuestions.push({
          id: `q_bank_${generatedQuestions.length + 1}_${Date.now()}`,
          questionText: `${sourceItem.questionText}${poolIndex >= bankItems.length ? ` (Part ${i + 1})` : ""}`,
          questionType: "MCQ",
          options: [...sourceItem.options],
          correctOption: sourceItem.correctOption,
          marks: marksPerQuestion,
        });
        poolIndex++;
      }
    }

    // Ensure exactly questionCount items
    generatedQuestions = generatedQuestions.slice(0, questionCount);

    const totalMaxMarks = generatedQuestions.reduce((acc, q) => acc + (q.marks || marksPerQuestion), 0);

    const resolvedDueDate = dueDate
      ? new Date(dueDate)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const formData: FormAssignmentData = {
      formType: "GOOGLE_FORM",
      instructions: defaultInstructions,
      questions: generatedQuestions,
    };

    const assignment = await prisma.assignment.create({
      data: {
        title: assignmentTitle,
        description: JSON.stringify(formData),
        courseLevel,
        dueDate: resolvedDueDate,
        maxMarks: totalMaxMarks,
        isPublished: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Generated AI Assignment "${assignment.title}" with ${generatedQuestions.length} questions (${totalMaxMarks} Marks).`,
      assignment,
    });
  } catch (error: any) {
    console.error("AI assignment generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate AI assignment." }, { status: 500 });
  }
}
