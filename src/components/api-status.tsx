"use client";
import { useApiStatus } from "@/hooks/use-api-status";

// This small client component displays the reusable health hook result as text and a colored dot.
export function ApiStatus() {
  // Read checking, connected or unavailable from the hook; it owns the request and cleanup.
  const status = useApiStatus();
  // role=status announces status changes. The decorative dot color follows the same state as the text.
  return <span role="status" className="flex items-center gap-2 text-xs text-stone-600">
    <span aria-hidden className={`size-2 rounded-full ${status === "connected" ? "bg-emerald-600" : status === "unavailable" ? "bg-amber-600" : "bg-stone-400"}`} />
    API {status}
  </span>;
}
