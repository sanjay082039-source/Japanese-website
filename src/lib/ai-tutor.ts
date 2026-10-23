/**
 * Client integration for the Japanese AI Tutor local fine-tuned model service.
 * Connects the Next.js web application to the FastAPI Qwen2.5 QLoRA server.
 */

export interface AiTutorHealth {
  available: boolean;
  status?: string;
  model?: string;
  adapterLoaded?: boolean;
  adapterPath?: string;
  gpuAvailable?: boolean;
  vramAllocatedGb?: number;
  vramTotalGb?: number;
  error?: string;
}

export interface AiTutorChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiTutorChatResponse {
  status: "ok" | "error";
  response: string;
  model: string;
  isFineTuned: boolean;
  latencyMs?: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  audioBase64?: string | null;
  error?: string;
}

export function getAiTutorBaseUrl(): string {
  const envUrl = process.env.AI_TUTOR_URL || "http://127.0.0.1:8000";
  return envUrl.replace(/\/+$/, "");
}

/**
 * Checks if the local Japanese AI Tutor service is running and healthy.
 * Times out after 2000ms so web requests are never blocked if the server is off.
 */
export async function getAiTutorHealth(): Promise<AiTutorHealth> {
  const baseUrl = getAiTutorBaseUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { available: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      available: data.status === "healthy",
      status: data.status,
      model: data.model || "Qwen/Qwen2.5-1.5B-Instruct",
      adapterLoaded: Boolean(data.adapter_loaded),
      adapterPath: data.adapter_path,
      gpuAvailable: Boolean(data.gpu_available),
      vramAllocatedGb: data.vram_allocated_gb,
      vramTotalGb: data.vram_total_gb,
    };
  } catch (err: any) {
    return {
      available: false,
      error: err.name === "AbortError" ? "Health check timed out" : err.message || "Connection refused",
    };
  }
}

/**
 * Submits a chat prompt and history to the fine-tuned Japanese AI Tutor engine.
 */
export async function chatWithAiTutor(params: {
  message: string;
  history?: AiTutorChatMessage[];
  customSystemPrompt?: string;
  enableTts?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<AiTutorChatResponse> {
  const baseUrl = getAiTutorBaseUrl();
  const apiKey = process.env.AI_TUTOR_API_KEY || "";

  const payload = {
    message: params.message,
    history: (params.history || []).map((h) => ({
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.content,
    })),
    custom_system_prompt: params.customSystemPrompt,
    enable_tts: Boolean(params.enableTts),
    generation: {
      temperature: params.temperature ?? 0.35,
      max_new_tokens: params.maxTokens ?? 512,
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        status: "error",
        response: "",
        model: "unknown",
        isFineTuned: false,
        error: `AI Tutor server error (HTTP ${res.status}): ${errText}`,
      };
    }

    const data = await res.json();
    return {
      status: "ok",
      response: data.response || "",
      model: data.model || "Qwen/Qwen2.5-1.5B-Instruct",
      isFineTuned: Boolean(data.is_fine_tuned),
      latencyMs: data.timings?.inference_ms,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      audioBase64: data.audio_base64 || null,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      status: "error",
      response: "",
      model: "unknown",
      isFineTuned: false,
      error: err.name === "AbortError" ? "AI Tutor inference timed out" : err.message,
    };
  }
}
