"use client";

import { useEffect } from "react";
import { PublicErrorFallback } from "@/components/PublicErrorBoundary";

export default function GlobalError({ error }) {
  useEffect(() => {
    fetch("/api/reliability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "public-error",
        message: error?.message || "GLOBAL_RENDER_ERROR",
        digest: error?.digest || "",
        path: window.location.pathname
      })
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="pt-BR">
      <body><PublicErrorFallback /></body>
    </html>
  );
}
