import { apiGet } from "@/services/api";
import { parseAnalysis } from "@/services/parse-analysis";
import type { ProductAnalysis } from "@/types/api";

// Category-tab response: a stable backend ID, readable label and count of enabled saved products.
export type DemoCategory = { id: string; name: string; product_count: number };
// Product-card response. Unknown price, rating or image fields remain null rather than fabricated defaults.
export type DemoProduct = {
  analysis_ready: boolean;
  id: string; category_id: string; version: number; title: string;
  price_text: string | null; overall_rating: number | null; rating_count: number | null;
  image_path: string | null;
};
// The client needs these saved fields to validate selection; the backend retains the complete dataset for analysis.
export type DemoEvidence = {
  id: string; version: number; limitations: string[];
  // Pick reuses just summary/topics from the shared report type instead of duplicating their definitions.
  product: Pick<ProductAnalysis["product"], "customers_say" | "feedback_topics">;
  topic_excerpts: { topic: string; text: string; source_file: string; partial: boolean }[];
};

// NEXT_PUBLIC values are baked into the UI build. This public backend address contains no OpenAI credentials.
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
// Narrow unknown JSON to a safe identifier before using it for category/product selection.
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]+$/.test(value);
// never means this helper always throws; callers stop instead of rendering malformed external JSON.
const invalid = (): never => { throw new Error("The server returned an invalid saved product dataset."); };

// Catalog reads never invoke Amazon or the model. Validate external JSON before rendering it.
export async function getDemoCategories(signal: AbortSignal): Promise<DemoCategory[]> {
  // apiGet checks HTTP status first; the second await reads the JSON response body.
  const data = await (await apiGet("/api/v1/demo/categories", signal)).json();
  // Reject non-list responses, malformed IDs and empty/impossible category counts at the API boundary.
  if (!Array.isArray(data) || data.some(c => !validId(c?.id) || typeof c.name !== "string" || !Number.isSafeInteger(c.product_count) || c.product_count < 1)) invalid();
  return data;
}

// Input: category ID plus cancellation signal. Output: validated card records, without any model invocation.
export async function getDemoProducts(category: string, signal: AbortSignal): Promise<DemoProduct[]> {
  // Encode the selected ID as one URL segment and forward cancellation to fetch.
  const data = await (await apiGet(`/api/v1/demo/categories/${encodeURIComponent(category)}/products`, signal)).json();
  // Check category ownership, version, optional numeric bounds and the exact permitted image endpoint.
  if (!Array.isArray(data) || data.some(p => !validId(p?.id) || p.category_id !== category || typeof p.analysis_ready !== "boolean" || typeof p.title !== "string" || !Number.isSafeInteger(p.version) || p.version < 1 ||
    (p.price_text !== null && typeof p.price_text !== "string") ||
    (p.overall_rating !== null && (typeof p.overall_rating !== "number" || p.overall_rating < 1 || p.overall_rating > 5)) ||
    (p.rating_count !== null && (!Number.isSafeInteger(p.rating_count) || p.rating_count < 0)) ||
    (p.image_path !== null && p.image_path !== `/api/v1/demo/products/${p.id}/image`))) invalid();
  return data;
}

// Input: product ID. Output: the saved evidence needed by selection; malformed source/topic metadata is rejected.
export async function getDemoEvidence(id: string, signal: AbortSignal): Promise<DemoEvidence> {
  // Loading a saved dataset is a read-only GET and does not start scraping or analysis.
  const data = await (await apiGet(`/api/v1/demo/products/${encodeURIComponent(id)}`, signal)).json();
  // Confirm the requested ID and check nested source arrays; TypeScript types alone cannot validate server JSON.
  if (data?.id !== id || !Number.isSafeInteger(data.version) || !Array.isArray(data.limitations) || data.limitations.some((s: unknown) => typeof s !== "string") ||
    !Array.isArray(data.topic_excerpts) || data.topic_excerpts.some((e: DemoEvidence["topic_excerpts"][number]) => !e || typeof e.topic !== "string" || typeof e.text !== "string" || typeof e.source_file !== "string" || typeof e.partial !== "boolean") ||
    !data.product || (data.product.customers_say !== null && typeof data.product.customers_say !== "string") ||
    !Array.isArray(data.product.feedback_topics) || data.product.feedback_topics.some((topic: DemoEvidence["product"]["feedback_topics"][number]) => !topic || typeof topic.name !== "string" ||
      (topic.text != null && typeof topic.text !== "string") || (topic.sentiment != null && !["positive", "negative", "mixed"].includes(topic.sentiment)) ||
      [topic.mention_count, topic.positive_count, topic.negative_count].some(n => n != null && (!Number.isSafeInteger(n) || n < 0)))) invalid();
  return data;
}

// Turn a backend-relative image path from a validated card into the absolute URL the browser can load.
export function demoImageUrl(path: string): string {
  // Remove trailing slashes before appending the path so configuration cannot produce a double slash.
  return baseUrl.replace(/\/+$/, "") + path;
}

// Public clicks only read permanent reports; missing files must never fall back to model generation.
export async function getDemoAnalysis(id: string, signal: AbortSignal): Promise<ProductAnalysis> {
  const response = await apiGet(`/api/v1/demo/products/${encodeURIComponent(id)}/analysis`, signal);
  // A proxy may return a non-JSON error; null keeps that failure on the controlled error path.
  const data = await response.json().catch(() => null);
  // Preserve safe transport errors instead of interpreting them as a product verdict.
  if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : `Saved product analysis failed (${response.status}).`);
  // Validate the full report contract before allowing React to render charts or findings.
  return parseAnalysis(data);
}
