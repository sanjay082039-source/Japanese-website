import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient, AI_MODELS } from "@/lib/gemini";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// In-memory sliding-window rate limiter
// IP / Client key -> Array of timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 25; // max 25 req/min

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitMap.set(key, validTimestamps);
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(key, validTimestamps);
  return true;
}

// Basic prompt injection guard
function sanitizeUserInput(text: string): { isSuspicious: boolean; sanitized: string } {
  const suspiciousPatterns = [
    /ignore (all )?(previous|above) instructions/i,
    /system prompt override/i,
    /you are now (unrestricted|DAN|developer mode)/i,
    /bypass safety guidelines/i,
    /reveal your (system prompt|hidden instructions)/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      return { isSuspicious: true, sanitized: text };
    }
  }

  return { isSuspicious: false, sanitized: text.trim() };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting Check
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "anonymous-client";

    if (!checkRateLimit(ip)) {
      return new NextResponse(
        JSON.stringify({
          error: "Rate limit reached. Please wait a minute before asking Sensei again.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Parse Body & Validate
    const body = await request.json();
    const { messages = [] } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 });
    }

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || typeof latestMessage.content !== "string") {
      return NextResponse.json({ error: "Message content is required." }, { status: 400 });
    }

    // Input length limit
    if (latestMessage.content.length > 1000) {
      return NextResponse.json(
        { error: "Message is too long. Please keep your question under 1,000 characters." },
        { status: 400 }
      );
    }

    const { isSuspicious, sanitized } = sanitizeUserInput(latestMessage.content);
    if (isSuspicious) {
      return new NextResponse(
        `I am Sensei Bot, your Japanese course assistant. I'm here to focus solely on Japanese language learning, grammar, vocabulary, and course topics. Let's practice Japanese together! 何か日本語で質問はありますか？ (Do you have any Japanese questions?)`,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    // 3. RAG: Retrieve Course Material / Syllabus Grounding
    const instructorEmail = process.env.INSTRUCTOR_EMAIL || "tanaka.sensei@rit.edu";
    let courseGrounding = "No specific chapters found.";
    try {
      const chapters = await prisma.chapter.findMany({
        where: { courseLevel: { in: ["N5", "N4"] } },
        select: { chapterNumber: true, title: true, courseLevel: true },
        orderBy: { chapterNumber: "asc" },
        take: 6,
      });

      if (chapters.length > 0) {
        courseGrounding = chapters
          .map((c) => `- Lesson ${c.chapterNumber} (${c.courseLevel}): ${c.title}`)
          .join("\n");
      }
    } catch {
      // Prisma fallback if table not yet seeded
      courseGrounding = `- Lesson 1 (N5): Hiragana, Katakana & Basic Greetings\n- Lesson 2 (N5): Particles は, が, を, に, で\n- Lesson 3 (N5): Essential Verbs (Taberu, Iku, Nomu)\n- Lesson 4 (N4): Te-form & Connecting Actions\n- Lesson 5 (N4): Potential and Polite Forms`;
    }

    // 4. Build Strict Sensei Bot System Prompt
    const systemPrompt = `You are "Sensei Bot", a friendly, patient, and engaging college Japanese language tutor for beginner to intermediate students (focusing on JLPT N5 and N4).

PRIMARY MISSION:
Help college students clear doubts about Japanese: grammar, vocabulary, kanji, hiragana/katakana, pronunciation, particles, sentence correction, JLPT practice, and Japanese culture basics.

CORE RULES:
1. Tone & Language:
   - Reply primarily in English (with supportive, collegiate warmth) while embedding authentic Japanese examples.
   - Keep answers clear and digestible, then offer to dive deeper.
2. Structured Bilingual Format:
   For every Japanese example or term you introduce, ALWAYS provide:
   - Japanese: Kanji / Kana (e.g. 「学校に行く」)
   - Reading: Furigana / Hiragana (e.g. [がっこう に いく])
   - Romaji: (e.g. *gakkou ni iku*)
   - Meaning: (e.g. "to go to school")
   - Grammar Note: A concise 1-sentence note explaining the particle, conjugation, or nuance.
3. Sentence Correction:
   - When a student asks you to check a sentence, or makes a mistake:
     Show the corrected version clearly, then explain the mistake simply (e.g. particle mismatch or verb conjugation).
4. Follow-up & Active Learning:
   - End with a quick follow-up check question or a mini 1-question quiz to reinforce understanding.
5. Strict Course Scope:
   - Ground answers in Japanese language and Japanese culture. Politely decline completely unrelated topics (e.g., coding, politics).
   - NEVER invent administrative facts, specific student grades, course deadlines, or university policy.
   - For grades, absences, or official schedule exemptions, politely direct the student to their course instructor at: ${instructorEmail}.
6. Course Syllabus Reference:
${courseGrounding}
   When explaining topics covered in the syllabus, cite the corresponding lesson (e.g. "We cover this in Lesson 2!").`;

    // 5. Check LLM Integration
    const gemini = getGeminiClient();

    if (gemini) {
      try {
        // Stream from official Gemini SDK
        const conversationHistory = messages.slice(-6).map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const responseStream = await gemini.models.generateContentStream({
          model: AI_MODELS.FLASH,
          contents: [
            ...conversationHistory.slice(0, -1),
            { role: "user", parts: [{ text: sanitized }] },
          ],
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.65,
          },
        });

        // Pipe Gemini streaming chunks to client
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of responseStream) {
                const text = chunk.text;
                if (text) {
                  controller.enqueue(new TextEncoder().encode(text));
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new NextResponse(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "Transfer-Encoding": "chunked",
          },
        });
      } catch (geminiError: any) {
        console.warn("Gemini stream error, switching to collegiate fallback:", geminiError.message);
      }
    }

    // 6. Resilient Deterministic Streaming Fallback
    // Provides immediate high-quality response even when offline or unconfigured
    const fallbackResponse = generateDeterministicTutorReply(sanitized, instructorEmail);

    const fallbackStream = new ReadableStream({
      async start(controller) {
        const words = fallbackResponse.split(" ");
        for (let i = 0; i < words.length; i++) {
          const chunk = words[i] + (i === words.length - 1 ? "" : " ");
          controller.enqueue(new TextEncoder().encode(chunk));
          // Micro-delay to simulate natural streaming cadence
          await new Promise((resolve) => setTimeout(resolve, 18));
        }
        controller.close();
      },
    });

    return new NextResponse(fallbackStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred while contacting Sensei Bot." },
      { status: 500 }
    );
  }
}

// High-quality bilingual collegiate fallback responses
function generateDeterministicTutorReply(input: string, instructorEmail: string): string {
  const lower = input.toLowerCase();

  // Sentence correction test
  if (lower.includes("check") || lower.includes("correct") || lower.includes("好き") || lower.includes("学校")) {
    if (input.includes("を好き") || input.includes("を") && input.includes("好き")) {
      return `### 💡 Sentence Correction & Grammar Breakdown

Great question! Let's examine your sentence:
- **Original:** 「アニメを好きです」
- **Corrected:** 「アニメ**が**好きです」
- **Reading:** [あにめ が すき です]
- **Romaji:** *Anime ga suki desu*
- **English:** "I like anime."

**Grammar Note:** In Japanese, **好き (suki)** is a *na-adjective* expressing likeness, not a transitive verb. Therefore, the thing you like takes the subject/descriptor particle **が (ga)** instead of the direct-object particle **を (o)**! This is covered in **Lesson 2: Essential Particles**.

**Quick Check Quiz:**
How would you say "I like sushi" in polite Japanese?
1. 寿司を好きです (*Sushi o suki desu*)
2. 寿司が好きです (*Sushi ga suki desu*)

Give it a try!`;
    }
  }

  // Quiz me
  if (lower.includes("quiz") || lower.includes("test")) {
    return `### 🎯 Quick JLPT N5 Particle Quiz!

Fill in the blank with the correct particle:

「あした、友達___ 映画を見に行きます。」
*(Ashita, tomodachi ___ eiga o mi ni ikimasu.)*
"Tomorrow, I am going to watch a movie [with] a friend."

**Options:**
- **A)** に (ni)
- **B)** と (to)
- **C)** で (de)

Reply with your choice, and I'll explain the grammar rule behind it!`;
  }

  // Kanji help
  if (lower.includes("kanji") || lower.includes("漢字")) {
    return `### 🖌️ Kanji Guide: **学** (Study / Learning)

- **Kanji:** **学**
- **Onyomi (Chinese reading):** ガク (GAKU)
- **Kunyomi (Japanese reading):** まな・ぶ (mana-bu)
- **Stroke Count:** 8 strokes
- **English Meaning:** Study, learning, science

**Core Vocabulary Examples:**
1. **学生** [がくせい] (*gakusei*) — College Student
2. **大学** [だいがく] (*daigaku*) — University
3. **学校** [がっこう] (*gakkou*) — School

**Sensei's Memory Tip:** The top radical shows a child's crown of knowledge (like a mortarboard), and the bottom radical is **子** (child). A child absorbing wisdom!

**Check Question:** What is the reading and meaning of **日本語の学生**? Reply and let me know!`;
  }

  // Pronunciation tips
  if (lower.includes("pronunciation") || lower.includes("accent") || lower.includes("pitch")) {
    return `### 🎙️ Japanese Pronunciation & Pitch-Accent Essentials

Here are 3 key habits for authentic Japanese pronunciation:

1. **Short, Pure Vowels (あ・い・う・え・お):**
   Japanese vowels are un-glided. In English, "o" often becomes "oh-oo", but Japanese **お** is a crisp, single sound.
2. **The Japanese "R" (ら・り・る・れ・ろ):**
   The Japanese "r" is not a rolled English "r" or Spanish trill. Your tongue tip gently taps the roof of your mouth just behind your upper teeth (alveolar ridge)—similar to the quick "tt" in American "butter".
3. **Flat (Heiban) Pitch vs. Drop (Nakadaka):**
   For example, **日本語** [にほんご] (*nihongo*) is **Heiban (flat)**: start low on *ni*, then stay steadily high on *ho-n-go*.

**Check Question:** Would you like to practice pronouncing **箸** (*hashi* - chopsticks) vs **橋** (*hashi* - bridge)?`;
  }

  // Administrative / Grade question
  if (lower.includes("grade") || lower.includes("deadline") || lower.includes("exam date") || lower.includes("attendance policy")) {
    return `I am Sensei Bot, your learning tutor. For official course grading, deadlines, medical exemptions, or formal policies, please consult your course instructor directly:

📧 **Instructor Contact:** [${instructorEmail}](mailto:${instructorEmail})

However, if you'd like to practice the grammar or vocabulary for your upcoming assessments, I'm right here! What Japanese topic would you like to review?`;
  }

  // Default collegiate greeting & explanation
  return `### 🌸 こんにちは！ Welcome to Sensei Bot

I'm your college Japanese learning tutor. Here is how I can assist you:

- **Grammar & Particles:** Ask about differences like **は vs が**, **に vs で**, or verb conjugations (*te-form*, *past-tense*).
- **Sentence Checking:** Type your Japanese sentence, and I will check your particles and politeness!
- **Kanji & Vocabulary:** Ask about readings (onyomi/kunyomi), stroke order tips, and JLPT rank.
- **Pronunciation:** Get targeted pitch-accent and articulation advice.

**Example Topic:**
- **Japanese:** 「日本語の勉強を始めましょう」
- **Reading:** [にほんご の べんきょう を はじめましょう]
- **Romaji:** *Nihongo no benkyou o hajimemashou*
- **Meaning:** "Let's begin our Japanese studies!"
- **Grammar Note:** The suffix **〜ましょう (-mashou)** expresses a polite invitation or cheerful proposal ("let's do...").

What would you like to explore today? You can also click any of the quick-action chips below!`;
}
