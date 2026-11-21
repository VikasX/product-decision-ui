const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function apiGet(path: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(baseUrl.replace(/\/+$/, "") + path, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return response;
}
