import { apiGet } from "@/services/api";
import { parseAnalysis } from "@/services/parse-analysis";
import type { ProductAnalysis } from "@/types/api";

export type DemoCategory = { id: string; name: string; product_count: number };
export type DemoProduct = {
  id: string; category_id: string; version: number; title: string;
  price_text: string | null; overall_rating: number | null; rating_count: number | null;
  image_path: string | null;
};
export type DemoEvidence = {
  id: string; version: number; limitations: string[];
  topic_excerpts: { topic: string; text: string; source_file: string; partial: boolean }[];
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]+$/.test(value);
const invalid = (): never => { throw new Error("The server returned an invalid saved product dataset."); };

// Catalog reads never invoke Amazon or the model. Validate external JSON before rendering it.
export async function getDemoCategories(signal: AbortSignal): Promise<DemoCategory[]> {
  const data = await (await apiGet("/api/v1/demo/categories", signal)).json();
  if (!Array.isArray(data) || data.some(c => !validId(c?.id) || typeof c.name !== "string" || !Number.isSafeInteger(c.product_count) || c.product_count < 1)) invalid();
  return data;
}

export async function getDemoProducts(category: string, signal: AbortSignal): Promise<DemoProduct[]> {
  const data = await (await apiGet(`/api/v1/demo/categories/${encodeURIComponent(category)}/products`, signal)).json();
  if (!Array.isArray(data) || data.some(p => !validId(p?.id) || p.category_id !== category || typeof p.title !== "string" || !Number.isSafeInteger(p.version) || p.version < 1 ||
    (p.price_text !== null && typeof p.price_text !== "string") ||
    (p.overall_rating !== null && (typeof p.overall_rating !== "number" || p.overall_rating < 1 || p.overall_rating > 5)) ||
    (p.rating_count !== null && (!Number.isSafeInteger(p.rating_count) || p.rating_count < 0)) ||
    (p.image_path !== null && p.image_path !== `/api/v1/demo/products/${p.id}/image`))) invalid();
  return data;
}

export async function getDemoEvidence(id: string, signal: AbortSignal): Promise<DemoEvidence> {
  const data = await (await apiGet(`/api/v1/demo/products/${encodeURIComponent(id)}`, signal)).json();
  if (data?.id !== id || !Number.isSafeInteger(data.version) || !Array.isArray(data.limitations) || data.limitations.some((s: unknown) => typeof s !== "string") ||
    !Array.isArray(data.topic_excerpts) || data.topic_excerpts.some((e: DemoEvidence["topic_excerpts"][number]) => !e || typeof e.topic !== "string" || typeof e.text !== "string" || typeof e.source_file !== "string" || typeof e.partial !== "boolean")) invalid();
  return data;
}

export function demoImageUrl(path: string): string {
  return baseUrl.replace(/\/+$/, "") + path;
}

// Only this explicit user action can start a guarded paid analysis; the backend owns cache reuse.
export async function analyzeDemoProduct(id: string, signal: AbortSignal, workflow: "httpx" | "langchain" = "httpx"): Promise<ProductAnalysis> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/v1/demo/products/${encodeURIComponent(id)}/analysis?workflow=${workflow}`, { method: "POST", signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : `Saved product analysis failed (${response.status}).`);
  return parseAnalysis(data);
}
