import type { ProductAnalysis } from "@/types/api";
import { parseAnalysis } from "@/services/parse-analysis";

// Use the separate Lab endpoint with the same report parser; no model call occurs in the UI.
export async function analyzeWithLangChain(url: string, signal: AbortSignal): Promise<ProductAnalysis> {
  // Use the same public backend setting as the main workflow, with localhost as the development default.
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  // Await the dedicated Lab endpoint rather than replacing the normal analysis route.
  const response = await fetch(baseUrl.replace(/\/+$/, "") + "/api/v1/analysis/langchain", {
    method: "POST", headers: { "Content-Type": "application/json" },
    // Send exactly the same product-URL request shape and keep cancellation tied to this Lab submission.
    body: JSON.stringify({ url }), signal,
  });
  // Read the response body once; invalid JSON becomes null and cannot be mistaken for a report.
  const data = await response.json().catch(() => null);
  // Handle access restrictions/provider errors before running the successful-report parser.
  if (!response.ok) {
    // Use a readable backend detail only when it is a string.
    const detail = typeof data?.detail === "string" ? data.detail : "Please try again.";
    throw new Error(`LangChain analysis failed (${response.status}). ${detail}`);
  }
  // Return the same validated frontend data shape used by the normal report components.
  return parseAnalysis(data);
}
