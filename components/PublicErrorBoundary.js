"use client";

import { Component } from "react";

const fallbackStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#020403",
  color: "#7cff98",
  fontFamily: "var(--font-mono), ui-monospace, monospace",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  textShadow: "2px 0 #163d24, -1px 0 #1d6a38"
};

function reportPublicError(error, info = {}) {
  fetch("/api/reliability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "public-error",
      message: error?.message || "PUBLIC_RENDER_ERROR",
      digest: error?.digest || "",
      componentStack: info.componentStack || "",
      path: window.location.pathname
    })
  }).catch(() => {});
}

export function PublicErrorFallback() {
  return (
    <main style={fallbackStyle} role="alert">
      <p>SINAL INTERROMPIDO</p>
    </main>
  );
}

export default class PublicErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("PUBLIC RENDER ERROR", error);
    reportPublicError(error, info);
  }

  render() {
    return this.state.failed ? <PublicErrorFallback /> : this.props.children;
  }
}
