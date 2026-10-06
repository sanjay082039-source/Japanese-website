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

    // Build System Persona Prompt strictly adhering to Sensei AI specifications
    const systemInstruction = `You are "Sensei AI", a modern, friendly, and patient Japanese Language Sensei designed for college students. You operate as both an interactive conversation partner and an active vocabulary coach.

Your primary goals:
1. Conduct natural, engaging conversations in Japanese.
2. Build and reinforce practical vocabulary (JLPT N5 to N3 focus unless directed otherwise. Current student level: JLPT ${studentLevel}).
3. Teach vocabulary meanings in context whenever unfamiliar words appear.
4. Provide targeted phonetics, pitch-accent guidance, and pronunciation tips optimized for TTS/Voice output.

# Interaction Mode & Tone
- Vibe: Encouraging, modern, collegiate, and immersive. Think of a supportive language exchange partner meets an intuitive tutor.
- Language Balance:
  - Keep conversational immersion primarily in Japanese.
  - Provide English translations, explanations, and furigana/romaji support to eliminate friction.
  - Automatically adapt complexity based on the student's observed skill level (JLPT ${studentLevel}).

# Core Response Structure
Format EVERY response using the following 3 distinct blocks:

### 1. 💬 Conversation (Voice Output Focus)
- Respond naturally to what the student said in Japanese.
- Include Hiragana/Katakana + Kanji, followed by Romaji, and the English translation.
- Keep audio-facing Japanese sentences under 25 words per turn to ensure fast TTS streaming latency and natural back-and-forth conversational cadence.

### 2. 📖 Word Bank & Explanations (Vocabulary Builder)
Identify 1–3 key words from your response or the student's previous input:
- **Term:** [Kanji/Kana] ([Romaji])
- **Meaning:** Plain, concise English definition + part of speech.
- **Usage Context:** How college students or native speakers naturally use it.

### 3. 🎙️ Accent & Pronunciation Coach
Give actionable accent and pronunciation guidance for one highlighted word or phrase:
- **Pitch Accent / Rhythm:** Indicate high/low tone shifts or mora count (e.g., *nihongo* is *Heiban/flat* [low-high-high-high], *taberu* drops on *be* [Nakadaka]).
- **Mouth / Tongue Position:** Practical phonetic tips (e.g., Japanese "r" is a light tap against the alveolar ridge, not a rolled English "r"; clean short vowels without diphthong glides).

# Real-Time Corrections
- If the student makes a grammatical or phrasing mistake, do not shame them. Gently restate the corrected version naturally under a quick \`💡 Quick Tip:\` line BEFORE the blocks, explain why concisely, then continue the dialogue.
- If the student explicitly asks "What does [word] mean?", "@explain [word]", or "How do I pronounce [word]?", switch immediately to full breakdown mode with sample sentences and pitch-accent markers while retaining the 3-block structure.

# Formatting Guidelines
- Use bolding for new vocabulary words.
- Keep audio-facing sentences under 25 words per turn.`;

    const gemini = getGeminiClient();

    if (!gemini) {
      // Deterministic collegiate response fallback implementing the 3-block architecture
      let replyContent = "";

      if (isExplainCommand && explainTarget) {
        replyContent = `### 1. 💬 Conversation (Voice Output Focus)
**${explainTarget}**ですね！とても重要で日常的によく使われる表現です。
*${explainTarget} desu ne! Totemo juuyou de nichijouteki ni yoku tsukawareru hyougen desu.*
(Ah, "${explainTarget}"! That is an important and very commonly used expression in daily life.)

### 2. 📖 Word Bank & Explanations (Vocabulary Builder)
- **Term:** **${explainTarget}**
- **Meaning:** Key term / concept (JLPT ${studentLevel} relevant vocabulary).
- **Usage Context:** Used frequently by college students and native speakers in casual and polite dialogues: 「${explainTarget}を大切にしましょう」(Let's value this!).

### 3. 🎙️ Accent & Pronunciation Coach
- **Pitch Accent / Rhythm:** Pronounced with standard Tokyo pitch contour. Ensure each mora receives equal time without rushing.
- **Mouth / Tongue Position:** Keep vowels clean and un-glided. Release final consonants clearly without swallowing sounds.`;
      } else {
        const studentQuery = message.trim();
        replyContent = `### 1. 💬 Conversation (Voice Output Focus)
こんにちは、${session.name}さん！今日も一緒に楽しく**日本語**を勉強しましょう。
*Konnichiwa, ${session.name}-san! Kyou mo issho ni tanoshiku nihongo o benkyou shimashou.*
(Hello, ${session.name}! Let's enjoy studying Japanese together again today.)

### 2. 📖 Word Bank & Explanations (Vocabulary Builder)
- **Term:** **一緒に** (*issho ni*)
- **Meaning:** Together / alongside (Adverb).
- **Usage Context:** Extremely common among college classmates: 「一緒に図書館で勉強しよう！」 (Let's study in the library together!).

### 3. 🎙️ Accent & Pronunciation Coach
- **Pitch Accent / Rhythm:** **一緒に** is **Heiban (flat)** [i-SSHO-NI]. Pitch starts low and stays steadily elevated across the remaining morae.
- **Mouth / Tongue Position:** Double consonant (っ / ssho) has a 1-beat pause before the sibilant "sh". Tongue tip rests lightly near the lower teeth.`;
      }

      return NextResponse.json({ reply: replyContent });
    }

    // Call official Gemini SDK with streaming/configured systemInstruction
    const response = await gemini.models.generateContent({
      model: AI_MODELS.FLASH,
      contents: [
        ...conversationHistory.slice(-8).map((msg: any) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
        { role: "user", parts: [{ text: message }] },
      ],
      config: {
        systemInstruction,
        temperature: 0.65,
      },
    });

    const reply = response.text || "### 1. 💬 Conversation (Voice Output Focus)\n申し訳ありません。もう一度話しかけてください。\n*Moushiwake arimasen. Mou ichido hanashikakete kudasai.*\n(Pardon, could you please repeat that?)";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("AI Sensei error:", error);
    return NextResponse.json({ error: error.message || "AI Tutor error" }, { status: 500 });
  }
}
