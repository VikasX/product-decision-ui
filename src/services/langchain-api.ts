import type { ProductAnalysis } from "@/types/api";
import { parseAnalysis } from "@/services/parse-analysis";

export async function analyzeWithLangChain(url: string, signal: AbortSignal): Promise<ProductAnalysis> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const response = await fetch(baseUrl.replace(/\/+$/, "") + "/api/v1/analysis/langchain", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }), signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : "Please try again.";
    throw new Error(`LangChain analysis failed (${response.status}). ${detail}`);
  }
  return parseAnalysis(data);
}
