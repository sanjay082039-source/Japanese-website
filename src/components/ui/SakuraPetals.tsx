"use client";

import React from "react";

interface Petal {
  id: number;
  left: number; // percentage across screen
  size: number; // px size
  duration: number; // seconds
  delay: number; // seconds
  driftX: number; // px
  swayDistance: number; // px
  rotateEnd: number; // degrees
  blur: number; // px for depth of field
  opacity: number;
}

// Deterministic seed array for SSR and client hydration consistency
const INITIAL_PETALS: Petal[] = Array.from({ length: 26 }, (_, i) => {
  const isForeground = i % 4 === 0;
  const isBackground = i % 3 === 0 && !isForeground;
  const seed = (i * 37) % 100;
  const seed2 = (i * 53) % 100;

  return {
    id: i,
    left: seed,
    size: isForeground ? 16 : isBackground ? 8 : 12,
    duration: isForeground ? 9 + (seed2 % 4) : isBackground ? 15 + (seed2 % 6) : 11 + (seed2 % 5),
    delay: seed % 10,
    driftX: (seed % 160) - 60,
    swayDistance: 25 + (seed % 20),
    rotateEnd: 420 + seed2 * 4,
    blur: isBackground ? 1.5 : isForeground ? 0 : 0.5,
    opacity: isForeground ? 0.9 : isBackground ? 0.45 : 0.7,
  };
});

export default function SakuraPetals({ count = 26 }: { count?: number }) {
  const petals = INITIAL_PETALS.slice(0, count);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-10 overflow-hidden"
    >
      {petals.map((petal) => (
        <span
          key={petal.id}
          className="sakura-petal"
          style={
            {
              left: `${petal.left}%`,
              width: `${petal.size}px`,
              height: `${petal.size * 1.3}px`,
              animationDuration: `${petal.duration}s, 4s`,
              animationDelay: `${petal.delay}s, ${petal.delay * 0.5}s`,
              filter: petal.blur > 0 ? `blur(${petal.blur}px)` : undefined,
              opacity: petal.opacity,
              "--drift-x": `${petal.driftX}px`,
              "--sway-distance": `${petal.swayDistance}px`,
              "--rotate-end": `${petal.rotateEnd}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
