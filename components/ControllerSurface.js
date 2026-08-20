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

async function navigateProjection(path) {
  if (!path) {
    return;
  }

  try {
    const response = await fetch("/api/projection", { cache: "no-store" });
    const data = await response.json();
    const projection = data.projection || {};
    const windows = Object.values(projection.windows || {});
    const active = projection.windows?.[projection.activeProjectionWindowId];
    const connectedWindow = active?.connected
      ? active
      : windows
        .filter((item) => item.connected)
        .sort((left, right) => `${right.lastHeartbeatAt || ""}`.localeCompare(`${left.lastHeartbeatAt || ""}`))[0];

    if (!connectedWindow?.id) {
      return;
    }

    await fetch("/api/projection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "navigate",
        projectionWindowId: connectedWindow.id,
        path
      }),
      keepalive: true
    });
  } catch {
    // A controller continua operacional mesmo sem uma janela pública conectada.
  }
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
