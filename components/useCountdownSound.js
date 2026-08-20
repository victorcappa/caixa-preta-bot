"use client";

import { useEffect, useRef } from "react";
import { robotSoundEngine } from "@/lib/robot-sound/RobotSoundEngine";

export default function useCountdownSound(value, { active = true, countdownKey = "countdown" } = {}) {
  const previousRef = useRef({ key: null, value: null });

  useEffect(() => {
    if (!active || !Number.isFinite(Number(value))) {
      previousRef.current = { key: null, value: null };
      return;
    }

    const normalizedValue = Math.max(0, Math.round(Number(value)));
    const normalizedKey = `${countdownKey}`;
    const previous = previousRef.current;
    if (previous.key === normalizedKey && previous.value === normalizedValue) return;

    previousRef.current = { key: normalizedKey, value: normalizedValue };
    robotSoundEngine.countdown(normalizedValue);
  }, [active, countdownKey, value]);
}
