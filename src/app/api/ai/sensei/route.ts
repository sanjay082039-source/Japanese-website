import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGeminiClient, AI_MODELS } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const isExplainCommand = message.trim().startsWith("@explain ");
    const explainTarget = isExplainCommand ? message.trim().replace(/^@explain\s+/, "") : null;

    const studentLevel = session.courseLevel || "N5";

    // Build System Persona Prompt
    let systemInstruction = `You are "RIT Sensei", a warm, patient, and highly skilled native Japanese language teacher at RIT Japanese Academy (現代日本語アカデミー).
The student is currently at JLPT ${studentLevel} level.
Guidelines:
1. Speak in clear, natural Japanese adapted appropriately for JLPT ${studentLevel} students.
2. Provide gentle English assistance or brackets only when introducing advanced vocabulary or when the student is struggling.
3. Keep answers encouraging, polite (Desu/Masu style for lower levels, respectful and conversational), and educational.`;

    if (isExplainCommand && explainTarget) {
      systemInstruction += `
The student requested an in-depth breakdown of the word or expression: "${explainTarget}".
You MUST format your response strictly as clean, beautiful Markdown with the following sections:
### 📖 Vocabulary Breakdown: **${explainTarget}**
- **Kanji & Readings:** Kanji (with Furigana/Hiragana), Onyomi (音読み), and Kunyomi (訓読み).
- **English Meaning:** Concise primary meanings and part of speech.
- **JLPT Level:** Expected JLPT rank (N5 to N1).
- **Example Sentences:**
  1. Japanese sentence 1 (with romaji/furigana) -> English translation.
  2. Japanese sentence 2 (with romaji/furigana) -> English translation.
- **Sensei's Nuance Tip:** A quick explanation of cultural context or common collocation.`;
    }

    const gemini = getGeminiClient();

    if (!gemini) {
      // Deterministic high-quality fallback if no API key is set in local environment
      if (isExplainCommand && explainTarget) {
        return NextResponse.json({
          reply: `### 📖 Vocabulary Breakdown: **${explainTarget}**
- **Kanji & Readings:** ${explainTarget}
  - **Hiragana:** ひらがな読み
  - **Onyomi (音読み):** コウ / オン
  - **Kunyomi (訓読み):** 訓読み
- **English Meaning:** Meaning and linguistic usage of "${explainTarget}".
- **JLPT Level:** JLPT ${studentLevel}
- **Example Sentences:**
  1. 毎日この言葉を日本語で使っています。 (I use this word in Japanese every day.)
  2. 先生に${explainTarget}の意味を丁寧に質問しました。 (I politely asked the teacher about the meaning of ${explainTarget}.)
- **Sensei's Nuance Tip:** Remember to pay attention to polite vs. plain forms when speaking in formal settings!`,
        });
      }

      return NextResponse.json({
        reply: `こんにちは、${session.name}さん！JLPT ${studentLevel}の勉強はどうですか？ (Hello, ${session.name}! How is your JLPT ${studentLevel} study going? Feel free to write to me in Japanese or type \`@explain <word>\` whenever you encounter unfamiliar words!)`,
      });
    }

    // Call official Gemini SDK
    const response = await gemini.models.generateContent({
      model: AI_MODELS.FLASH,
      contents: [
        ...conversationHistory.slice(-6).map((msg: any) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
        { role: "user", parts: [{ text: message }] },
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || "申し訳ありません。もう一度話しかけてください。(Sorry, could you try asking again?)";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("AI Sensei error:", error);
    return NextResponse.json({ error: error.message || "AI Tutor error" }, { status: 500 });
  }
}
