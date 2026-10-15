"use client";

import { usePathname } from "next/navigation";
import { isProjectionPath } from "@/lib/projectionScreens";
import PublicOperatorLayout from "./PublicOperatorLayout";
import PublicErrorBoundary from "./PublicErrorBoundary";

export default function ProjectionOperatorSurface({ children }) {
  const pathname = usePathname();
  if (pathname === "/treinamento") return <PublicErrorBoundary>{children}</PublicErrorBoundary>;
  if (!isProjectionPath(pathname)) return children;
  return <PublicErrorBoundary><PublicOperatorLayout>{children}</PublicOperatorLayout></PublicErrorBoundary>;
}
