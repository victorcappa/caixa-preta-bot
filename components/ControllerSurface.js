"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import ControllerBlackoutBar from "./ControllerBlackoutBar";
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
        <div className={styles.controllerGroups}>
          {groupedSurfaces.map((group) => (
            <section className={styles.group} key={group.id} aria-label={`${group.label} — ${group.name}`}>
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
                    {surface.sceneNumber ? <span className={styles.tabSceneNumber}>{surface.sceneNumber}</span> : null}
                    <span>{surface.menuLabel || surface.shortName || surface.label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
        </div>
      </nav>
      <ControllerBlackoutBar />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
