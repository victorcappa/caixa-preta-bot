"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  getControllerSurfaceGroups,
  sortedControllerSurfaces,
  isControllerSurfaceActive
} from "@/lib/controllerSurfaces";
import styles from "./ControllerSurface.module.css";

function navigateProjection(path) {
  if (!path) {
    return;
  }

  const body = JSON.stringify({ action: "navigate", path });

  if (navigator.sendBeacon) {
    const queued = navigator.sendBeacon("/api/projection", new Blob([body], { type: "application/json" }));

    if (queued) {
      return;
    }
  }

  fetch("/api/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => {});
}

export default function ControllerSurface({ children }) {
  const pathname = usePathname();
  const activeSurface = sortedControllerSurfaces.find((surface) => isControllerSurfaceActive(surface, pathname));
  const groupedSurfaces = getControllerSurfaceGroups();

  useEffect(() => {
    if (!activeSurface?.projectionPath) {
      return;
    }

    if (activeSurface.autoNavigateProjection === false) {
      return;
    }

    navigateProjection(activeSurface.projectionPath);
  }, [activeSurface?.autoNavigateProjection, activeSurface?.projectionPath]);

  return (
    <div className={styles.surface}>
      <nav className={styles.tabs} aria-label="Controllers cênicos">
        {groupedSurfaces.map((group) => (
          <section className={styles.group} key={group.id} aria-label={`${group.label} — ${group.name}`}>
            <div className={styles.groupLabel}>
              <span>{group.label}</span>
              <strong>{group.name}</strong>
            </div>
            <div className={styles.groupTabs}>
              {group.surfaces.map((surface) => {
                const active = isControllerSurfaceActive(surface, pathname);

                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={active ? styles.activeTab : styles.tab}
                    href={surface.path}
                    key={surface.id}
                    onClick={() => navigateProjection(surface.projectionPath)}
                    title={surface.name}
                  >
                    {surface.shortName || surface.label}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
