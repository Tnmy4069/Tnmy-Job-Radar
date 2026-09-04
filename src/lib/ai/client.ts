import { geminiApiKey, geminiFallbackModel, geminiModel, geminiTimeoutMs } from "./config";
import { classifyGeminiError, GeminiError } from "./errors";
import {
  BATCH_ANALYSIS_JSON_SCHEMA,
  JOB_ANALYSIS_JSON_SCHEMA,
} from "./schema";
import { GEMINI_SYSTEM_INSTRUCTION } from "./prompt";

export type GeminiGenerateInput = {
  user: string;
  batch: boolean;
  timeoutMs?: number;
  model?: string;
};

export type GeminiGenerateResult = {
  text: string;
  model: string;
  tokens: number;
};

export type GeminiTransport = {
  generate(input: GeminiGenerateInput): Promise<GeminiGenerateResult>;
};

let override: GeminiTransport | null = null;
let cachedClient: unknown = null;

export function setGeminiTransportForTests(transport: GeminiTransport | null) {
  override = transport;
}

export async function generateGeminiAnalysis(input: GeminiGenerateInput): Promise<GeminiGenerateResult> {
  const transport = override ?? productionTransport;
  return transport.generate(input);
}

const productionTransport: GeminiTransport = {
  async generate(input) {
    const key = geminiApiKey();
    if (!key) {
      throw new GeminiError("GEMINI_API_KEY is missing", { kind: "missing_key", transient: false });
    }

    const model = input.model || geminiModel();
    const timeoutMs = input.timeoutMs ?? geminiTimeoutMs();

    try {
      return await callGemini({ apiKey: key, model, input, timeoutMs });
    } catch (error) {
      const classified = classifyGeminiError(error);
      const fallback = geminiFallbackModel();
      if (fallback && fallback !== model && classified.kind !== "quota_exhausted" && classified.kind !== "missing_key") {
        const isModelError =
          classified.status === 404 ||
          /model|not found|not supported/i.test(classified.message);
        if (isModelError) {
          return callGemini({ apiKey: key, model: fallback, input, timeoutMs });
        }
      }
      throw classified;
    }
  },
};

async function callGemini(args: {
  apiKey: string;
  model: string;
  input: GeminiGenerateInput;
  timeoutMs: number;
}): Promise<GeminiGenerateResult> {
  const { GoogleGenAI } = await import("@google/genai");
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey: args.apiKey });
  }
  const ai = cachedClient as {
    models: {
      generateContent: (req: Record<string, unknown>) => Promise<{
        text?: string;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      }>;
    };
  };

  const schema = args.input.batch ? BATCH_ANALYSIS_JSON_SCHEMA : JOB_ANALYSIS_JSON_SCHEMA;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), args.timeoutMs);

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: args.model,
        contents: args.input.user,
        config: {
          systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
          temperature: 0.2,
          abortSignal: abort.signal,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      }),
      sleep(args.timeoutMs).then(() => {
        abort.abort();
        throw new GeminiError("Gemini request timed out", { kind: "timeout", transient: true });
      }),
    ]);

    const text = typeof response.text === "string" ? response.text : "";
    if (!text.trim()) {
      throw new GeminiError("Gemini returned an empty response", {
        kind: "invalid_response",
        transient: false,
      });
    }
    const usage = response.usageMetadata;
    const tokens = usage?.totalTokenCount ?? (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0);
    return { text, model: args.model, tokens };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resetGeminiClientForTests() {
  cachedClient = null;
}
