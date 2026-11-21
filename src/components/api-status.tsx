"use client";
import { useApiStatus } from "@/hooks/use-api-status";

export function ApiStatus() {
  const status = useApiStatus();
  return <span role="status" className="flex items-center gap-2 text-xs text-stone-600">
    <span aria-hidden className={`size-2 rounded-full ${status === "connected" ? "bg-emerald-600" : status === "unavailable" ? "bg-amber-600" : "bg-stone-400"}`} />
    API {status}
  </span>;
}
