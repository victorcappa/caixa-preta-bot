"use client";

import { displayBlackoutIsActive } from "@/lib/displayBlackout";
import styles from "./DisplayBlackout.module.css";

export default function DisplayBlackout({ blackout = null, target }) {
  if (!displayBlackoutIsActive(blackout, target)) {
    return null;
  }

  return <div className={styles.blackout} data-blackout-target={target} aria-hidden="true" />;
}
