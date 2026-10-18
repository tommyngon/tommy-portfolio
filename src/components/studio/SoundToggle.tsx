"use client";
import { useSyncExternalStore } from "react";
import HoverTranslate from "../HoverTranslate";
import { isSoundEnabled, setSoundEnabled, subscribeSound } from "./sound";

export default function SoundToggle({ className }: { className?: string }) {
  const on = useSyncExternalStore(subscribeSound, isSoundEnabled, () => false);
  return (
    <button
      type="button"
      className={className}
      aria-pressed={on}
      aria-label={on ? "Mute sound" : "Enable sound"}
      onClick={() => setSoundEnabled(!on)}
    >
      <HoverTranslate en="sound" no="lyd" align="start" /> <HoverTranslate en={on ? "on" : "off"} no={on ? "på" : "av"} align="start" />
    </button>
  );
}
