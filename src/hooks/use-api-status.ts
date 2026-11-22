import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import type { ConnectionStatus } from "@/types/api";

// One bounded liveness check per mount; returns UI connection state, not integration readiness.
export function useApiStatus() {
  // Begin at checking, then update React state after this one health request completes.
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  // Run after mount; an empty dependency list means this does not repeat on every render.
  useEffect(() => {
    // Let cleanup and the five-second timer cancel the pending health fetch.
    const controller = new AbortController();
    // Ignore late promise callbacks after unmount, including failed aborts.
    let active = true;
    // Bound the initial check even when the backend accepts a connection but stalls.
    // Bound the initial check so the UI does not remain checking indefinitely.
    const timer = window.setTimeout(() => controller.abort(), 5000);
    // Call backend liveness only; this does not ping Amazon or consume model credit.
    apiGet("/api/v1/health", controller.signal)
      // Only a still-mounted component may update itself after a successful health response.
      .then(() => { if (active) setStatus("connected"); })
      // Network errors, non-success statuses and timer cancellation all mark this check unavailable.
      .catch(() => { if (active) setStatus("unavailable"); })
      // Stop the timer as soon as the health request settles.
      .finally(() => window.clearTimeout(timer));
    // React runs this cleanup on unmount and during development effect checks.
    return () => {
      // Prevent a late completion callback from updating a component that is no longer mounted.
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);
  // Return just the connection state for a status component to display.
  return status;
}
