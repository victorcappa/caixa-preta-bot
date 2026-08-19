"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { controllerSurfaces, isControllerSurfaceActive } from "@/lib/controllerSurfaces";
import styles from "./ControllerSurface.module.css";

export default function ControllerSurface({ children }) {
  const pathname = usePathname();

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
