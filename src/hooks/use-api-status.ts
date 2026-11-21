import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import type { ConnectionStatus } from "@/types/api";

export function useApiStatus() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    // Bound the initial check even when the backend accepts a connection but stalls.
    const timer = window.setTimeout(() => controller.abort(), 5000);
    apiGet("/api/v1/health", controller.signal)
      .then(() => { if (active) setStatus("connected"); })
      .catch(() => { if (active) setStatus("unavailable"); })
      .finally(() => window.clearTimeout(timer));
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);
  return status;
}
