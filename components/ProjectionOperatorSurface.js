"use client";

import { usePathname } from "next/navigation";
import { getProjectionScreenByPath } from "@/lib/projectionScreens";
import PublicOperatorLayout from "./PublicOperatorLayout";
import PublicErrorBoundary from "./PublicErrorBoundary";

export default function ProjectionOperatorSurface({ children }) {
  const pathname = usePathname();
  const screen = getProjectionScreenByPath(pathname);
  if (!screen) return children;
  if (screen.standalone) return <PublicErrorBoundary>{children}</PublicErrorBoundary>;
  return <PublicErrorBoundary><PublicOperatorLayout>{children}</PublicOperatorLayout></PublicErrorBoundary>;
}
