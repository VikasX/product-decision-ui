import type { ProductAnalysis } from "@/types/api";
import { parseAnalysis } from "@/services/parse-analysis";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function apiGet(path: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(baseUrl.replace(/\/+$/, "") + path, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return response;
}

export async function analyzeProduct(url: string, signal: AbortSignal): Promise<ProductAnalysis> {
  const response = await fetch(baseUrl.replace(/\/+$/, "") + "/api/v1/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : "Please try again.";
    throw new Error(`Analysis failed (${response.status}). ${detail}`);
  }
  return parseAnalysis(data);
}
