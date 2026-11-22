import type { ProductAnalysis } from "@/types/api";
import { parseAnalysis } from "@/services/parse-analysis";

// Public build-time backend URL, not a secret; OpenAI credentials stay on the server.
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// Health GET returns a Response; no-store keeps stale browser cache from faking availability.
export async function apiGet(path: string, signal: AbortSignal): Promise<Response> {
  // Wait for the configured backend endpoint. The abort signal lets the owning component cancel its fetch.
  const response = await fetch(baseUrl.replace(/\/+$/, "") + path, { signal, cache: "no-store" });
  // Non-2xx status means an HTTP error; do not treat its JSON error body as a report.
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  // The health caller only needs success/failure, so return the response without interpreting report fields.
  return response;
}

// Amazon URL + abort signal in; POST to HTTP workflow and return a runtime-validated report.
export async function analyzeProduct(url: string, signal: AbortSignal): Promise<ProductAnalysis> {
  // Wait for the configured backend endpoint. The abort signal lets the owning component cancel its fetch.
  const response = await fetch(baseUrl.replace(/\/+$/, "") + "/api/v1/analysis", {
    // Send a JSON body rather than putting user input into an endpoint path.
    method: "POST",
    // Tell FastAPI to parse the request body as JSON.
    headers: { "Content-Type": "application/json" },
    // Serialize the product link using the AnalysisRequest shape expected by the backend.
    body: JSON.stringify({ url }),
    signal,
  });
  // Attempt to read JSON; use null for malformed/empty bodies so the error path remains controlled.
  const data = await response.json().catch(() => null);
  // Non-2xx status means an HTTP error; do not treat its JSON error body as a report.
  if (!response.ok) {
    // Use only a string error detail, with a safe fallback when the backend format is unexpected.
    const detail = typeof data?.detail === "string" ? data.detail : "Please try again.";
    // Throw a readable message that the form catch block will display.
    throw new Error(`Analysis failed (${response.status}). ${detail}`);
  }
  // TypeScript types alone cannot validate JSON arriving from an external API.
  return parseAnalysis(data);
}
