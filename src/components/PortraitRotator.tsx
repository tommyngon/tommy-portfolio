"use client";

import Image from "next/image";
import { useState } from "react";

// One quarter-turn per click: the nose goes toward → right → away → left, so the
// sequence reads as a single head turning in one direction.
const portraits = [
  { src: "/portrait/front.webp", alt: "Tommy Nguyen, front" },
  { src: "/portrait/profile-right.webp", alt: "Tommy Nguyen, right profile" },
  { src: "/portrait/back.webp", alt: "Tommy Nguyen, from behind" },
  { src: "/portrait/profile-left.webp", alt: "Tommy Nguyen, left profile" },
];

export default function PortraitRotator() {
  const [index, setIndex] = useState(0);
  const [clicked, setClicked] = useState(false);

  const advance = () => {
    setIndex((i) => (i + 1) % portraits.length);
    setClicked(true);
  };

  const previous = (index + portraits.length - 1) % portraits.length;

  return (
    <button
      type="button"
      className="portrait"
      onClick={advance}
      aria-label="Rotate portrait to next view"
      data-clicked={clicked || undefined}
    >
      {portraits.map((p, i) => (
        <Image
          key={p.src}
          src={p.src}
          alt={i === index ? p.alt : ""}
          aria-hidden={i !== index}
          fill
          sizes="(max-width: 640px) 125px, 150px"
          loading="eager"
          draggable={false}
          className="portrait-img"
          data-state={i === index ? "active" : i === previous ? "leaving" : "waiting"}
        />
      ))}
      <span className="portrait-cue" aria-hidden="true">
        click to rotate
      </span>
    </button>
  );
}
