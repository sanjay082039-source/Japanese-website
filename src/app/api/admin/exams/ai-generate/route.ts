import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getGeminiClient, AI_MODELS } from "@/lib/gemini";
import { z } from "zod";

export const dynamic = "force-dynamic";

const GenerateAssessmentSchema = z.object({
  courseLevel: z.enum(["N1", "N2", "N3", "N4", "N5"]),
  focusArea: z.enum(["KANJI_VOCAB", "GRAMMAR", "READING_COMPREHENSION", "MIXED"]),
  questionCount: z.number().min(1).max(50).default(5),
  durationMinutes: z.number().min(5).max(180).default(30),
  title: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
    }

    const rawBody = await request.json();
    const parsed = GenerateAssessmentSchema.parse(rawBody);

    const { courseLevel, focusArea, questionCount, durationMinutes, title } = parsed;

    const examTitle =
      title ||
      `Official JLPT ${courseLevel} ${focusArea.replace("_", " ")} Assessment (${questionCount} Items)`;

    let generatedQuestions: Array<{
      questionText: string;
      options: string[];
      correctOption: string;
      marks: number;
      explanation: string;
    }> = [];

    const gemini = getGeminiClient();

    if (gemini) {
      const prompt = `Generate a rigorous, authentic JLPT ${courseLevel} examination in JSON format.
Focus Area: ${focusArea}
Number of Questions: EXACTLY ${questionCount} questions. You must generate exactly ${questionCount} items.

Return ONLY a valid JSON array of ${questionCount} objects conforming exactly to this structure:
[
  {
    "questionText": "Authentic Japanese prompt (with furigana in brackets if needed, or clear formatting)",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctOption": "0", // 0-indexed string index: "0", "1", "2", or "3"
    "marks": 2,
    "explanation": "Nuance analysis explaining why the option is correct in English and Japanese."
  }
]`;

      try {
        const response = await gemini.models.generateContent({
          model: AI_MODELS.FLASH,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            systemInstruction:
              "You are a master JLPT test creator for the Japan Foundation and JEES. Generate genuine, impeccably accurate Japanese exam questions adhering strictly to requested question count.",
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        });

        const text = response.text || "[]";
        const parsedJson = JSON.parse(text);
        if (Array.isArray(parsedJson) && parsedJson.length > 0) {
          generatedQuestions = parsedJson;
        }
      } catch (err) {
        console.error("Failed to parse Gemini output, falling back to curated test items:", err);
      }
    }

    // Fallback if AI didn't return enough questions: guarantee EXACT questionCount items
    if (generatedQuestions.length < questionCount) {
      const needed = questionCount - generatedQuestions.length;
      const { getFallbackQuestionsForLevel } = await import("@/lib/homeworkQuestionBank");
      const bankItems = getFallbackQuestionsForLevel(courseLevel, "exam_" + Date.now().toString().slice(-4));
      
      let poolIndex = 0;
      for (let i = 0; i < needed; i++) {
        const sourceItem = bankItems[poolIndex % bankItems.length];
        generatedQuestions.push({
          questionText: `${sourceItem.questionText}${poolIndex >= bankItems.length ? ` (Item ${i + 1})` : ""}`,
          options: [...sourceItem.options],
          correctOption: String(sourceItem.correctOption),
          marks: sourceItem.marks || 2,
          explanation: sourceItem.explanation,
        });
        poolIndex++;
      }
    }

    // Slice to exact question count in case AI produced extra
    generatedQuestions = generatedQuestions.slice(0, questionCount);

    const totalMarks = generatedQuestions.reduce((acc, q) => acc + (q.marks || 2), 0);
    const now = new Date();
    const examEndTime = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days active window

    // Persist new exam and questions
    const createdExam = await prisma.exam.create({
      data: {
        title: examTitle,
        description: `Generated AI Assessment for JLPT ${courseLevel} focusing on ${focusArea}.`,
        courseLevel,
        startTime: now,
        endTime: examEndTime,
        durationMinutes,
        totalMarks,
        passingMarks: Math.round(totalMarks * 0.6),
        isPublished: true,
        isAiGenerated: true,
        proctoringRules: JSON.stringify({
          clipboardBlock: true,
          devtoolsBlock: true,
          tabSwitchLimit: 3,
          fullScreenRequired: true,
          selectionBlock: true,
        }),
        questions: {
          create: generatedQuestions.map((q, idx) => ({
            questionText: q.questionText,
            questionType: "MCQ",
            optionsJson: JSON.stringify(q.options),
            correctOption: String(q.correctOption),
            marks: q.marks || 2,
            orderIndex: idx,
            explanation: q.explanation || "",
          })),
        },
      },
      include: {
        questions: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Generated exam "${createdExam.title}" with ${createdExam.questions.length} questions.`,
      exam: createdExam,
    });
  } catch (error: any) {
    console.error("AI assessment generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate exam." }, { status: 500 });
  }
}
