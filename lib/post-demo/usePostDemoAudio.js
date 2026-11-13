"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { robotSoundEngine } from "../robot-sound/RobotSoundEngine.js";
import { GLOBAL_VOLUME_EVENT, normalizeGlobalVolume } from "../globalVolume.js";
import { selectPostDemoAudioSource } from "./audioSource.js";

function localProjectionId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("projectionWindow")?.trim()
    || window.sessionStorage.getItem("caixa-preta.projectionWindowId")?.trim() || "";
}

export function usePostDemoAudio(snapshot, controller) {
  const live = useRef(snapshot), volume = useRef(1), stopped = useRef(false), mounted = useRef(true), wasPlaying = useRef(false), resetSequence = useRef(null);
  const [status, setStatus] = useState("LOCKED");
  live.current = snapshot;
  const isSource = useCallback(() => {
    const selected = selectPostDemoAudioSource(live.current?.projection);
    return selected?.id === localProjectionId() && selected?.controller === controller;
  }, [controller]);
  useEffect(() => {
    mounted.current = true;
    const disarmUnlock = robotSoundEngine.armAutoUnlock(), disarmRelay = robotSoundEngine.armAudioRelay({ sink: controller });
    const unsubscribe = robotSoundEngine.subscribeStatus(setStatus);
    const stop = () => { stopped.current = true; robotSoundEngine.stopAll(); };
    const changeVolume = event => {
      volume.current = normalizeGlobalVolume(event.detail, 1);
      if (volume.current === 0) robotSoundEngine.stopAll();
    };
    window.addEventListener("caixa-preta:stopall", stop);
    window.addEventListener(GLOBAL_VOLUME_EVENT, changeVolume);
    return () => {
      mounted.current = false;
      if (wasPlaying.current) robotSoundEngine.stopAll();
      else if (controller) robotSoundEngine.stopAll({ localOnly: true });
      window.removeEventListener("caixa-preta:stopall", stop);
      window.removeEventListener(GLOBAL_VOLUME_EVENT, changeVolume);
      unsubscribe(); disarmRelay(); disarmUnlock();
    };
  }, [controller]);
  useEffect(() => {
    if (!snapshot?.robotSound) return;
    robotSoundEngine.setSettings(snapshot.robotSound);
    const sequence = Number(snapshot.robotSound.outputResetSequence || 0);
    if (resetSequence.current !== null && resetSequence.current !== sequence) void robotSoundEngine.reconnectOutput();
    resetSequence.current = sequence;
  }, [snapshot?.robotSound]);
  useEffect(() => {
    volume.current = normalizeGlobalVolume(snapshot?.globalVolume, 1);
    if (volume.current === 0) robotSoundEngine.stopAll();
  }, [snapshot?.globalVolume]);
  useEffect(() => {
    stopped.current = !snapshot?.postDemo?.active || Boolean(snapshot?.reliability?.emergencyMode?.active);
    if (snapshot?.postDemo?.active === false || snapshot?.reliability?.emergencyMode?.active) robotSoundEngine.stopAll({ localOnly: true });
  }, [snapshot?.postDemo?.active, snapshot?.reliability?.emergencyMode?.active]);
  useEffect(() => {
    const playing = isSource() && Boolean(snapshot?.postDemo?.active) && !snapshot?.reliability?.emergencyMode?.active && snapshot?.robotSound?.enabled && volume.current > 0;
    if (wasPlaying.current && !playing) robotSoundEngine.stopAll();
    wasPlaying.current = playing;
  });
  const onCharacter = useCallback((character, { messageId } = {}) => {
    const state = live.current;
    if (!mounted.current || stopped.current || !isSource() || !state?.postDemo?.active || state.reliability?.emergencyMode?.active || !state.robotSound?.enabled || volume.current <= 0) return;
    const speech = state.postDemo.rounds?.at(-1) || state.postDemo.opening;
    if (!speech || speech.id !== messageId || speech.presentedAt) return;
    robotSoundEngine.typing(character, { volumeScale: volume.current });
  }, [isSource]);
  return { onCharacter, status, unlock: () => robotSoundEngine.unlock(), needsUnlock: Boolean(snapshot?.robotSound?.enabled) && !["RUNNING", "UNSUPPORTED"].includes(status) };
}
