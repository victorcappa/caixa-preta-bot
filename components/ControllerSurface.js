"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { controllerSurfaces, isControllerSurfaceActive } from "@/lib/controllerSurfaces";
import styles from "./ControllerSurface.module.css";

function navigateProjection(path) {
  if (!path) {
    return;
  }

  fetch("/api/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "navigate", path }),
    keepalive: true
  }).catch(() => {});
}

export default function ControllerSurface({ children }) {
  const pathname = usePathname();
  const activeSurface = controllerSurfaces.find((surface) => isControllerSurfaceActive(surface, pathname));

  useEffect(() => {
    navigateProjection(activeSurface?.projectionPath);
  }, [activeSurface?.projectionPath]);

  return (
    <div className={styles.surface}>
      <nav className={styles.tabs} aria-label="Controllers">
        {controllerSurfaces.map((surface) => {
          const active = isControllerSurfaceActive(surface, pathname);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={active ? styles.activeTab : styles.tab}
              href={surface.path}
              key={surface.id}
              onClick={() => navigateProjection(surface.projectionPath)}
            >
              {surface.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
