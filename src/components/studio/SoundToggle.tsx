"use client";
import { useSyncExternalStore } from "react";
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
      <span className="ui-caps">SOUND</span> <span className="ui-caps">{on ? "ON" : "OFF"}</span>
    </button>
  );
}
