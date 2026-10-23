import { NextResponse } from "next/server";
import { getAiTutorHealth } from "@/lib/ai-tutor";
import { getGeminiClient } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await getAiTutorHealth();
    const hasGemini = Boolean(getGeminiClient());

    return NextResponse.json({
      online: health.available,
      provider: health.available ? "local_qlora" : hasGemini ? "gemini_cloud" : "deterministic_fallback",
      providerName: health.available
        ? "Custom Fine-Tuned AI Tutor (Local GPU)"
        : hasGemini
        ? "Google Gemini Cloud"
        : "Collegiate Deterministic Tutor",
      model: health.model || (hasGemini ? "gemini-1.5-flash" : "rule-based-sensei"),
      isFineTuned: health.adapterLoaded ?? false,
      adapterPath: health.adapterPath ?? null,
      gpuAvailable: health.gpuAvailable ?? false,
      vramAllocatedGb: health.vramAllocatedGb ?? 0,
      vramTotalGb: health.vramTotalGb ?? 0,
      error: health.error ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        online: false,
        provider: "deterministic_fallback",
        providerName: "Collegiate Deterministic Tutor",
        model: "rule-based-sensei",
        isFineTuned: false,
        error: err.message,
      },
      { status: 200 }
    );
  }
}
