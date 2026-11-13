"use client";
/* eslint-disable @next/next/no-img-element -- Original local card reference, visually clipped without changing the source. */
import { useId } from "react";
import styles from "./PostDemo.module.css";

export default function PostDemoCardImage({ card, surface }) {
  const id = useId().replace(/:/g, "");
  const valid = Array.isArray(surface) && surface.length === 4 && surface.every(point => Array.isArray(point) && point.length === 2 && point.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  let path = "";
  if (valid) {
    const center = surface.reduce((sum, point) => [sum[0] + point[0] / 4, sum[1] + point[1] / 4], [0, 0]);
    // Stay just inside the paper edge and follow its rounded corners, leaving the photograph outside transparent.
    const corners = surface.map(point => point.map((value, axis) => value * .99 + center[axis] * .01));
    const toward = (point, other) => point.map((value, axis) => value * .95 + other[axis] * .05).join(" ");
    path = corners.map((point, index) => `${index ? "L" : "M"}${toward(point, corners[(index + 3) % 4])} Q${point.join(" ")} ${toward(point, corners[(index + 1) % 4])}`).join(" ") + " Z";
  }
  return <>
    <svg className={styles.cardMask} aria-hidden="true" focusable="false"><defs><clipPath id={id} clipPathUnits="objectBoundingBox"><path d={path} /></clipPath></defs></svg>
    <img src={card.imageUrl} alt={card.name} data-card-cutout={Boolean(path)} style={{ clipPath: `url(#${id})`, visibility: path ? "visible" : "hidden" }} />
  </>;
}
