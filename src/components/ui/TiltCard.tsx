"use client";

import React, { useRef, useState, useCallback } from "react";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number; // max tilt degrees (default: 12)
  glare?: boolean;
}

export default function TiltCard({
  children,
  className = "",
  maxTilt = 12,
  glare = true,
  ...props
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({
    transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
  });
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({
    opacity: 0,
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      // Normalization from -1 to 1
      const xPct = (clientX / rect.width) * 2 - 1;
      const yPct = (clientY / rect.height) * 2 - 1;

      // Rotation angles
      const rotateX = -yPct * maxTilt;
      const rotateY = xPct * maxTilt;

      setTiltStyle({
        transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`,
      });

      if (glare) {
        setGlareStyle({
          opacity: 0.35,
          background: `radial-gradient(circle at ${(clientX / rect.width) * 100}% ${(clientY / rect.height) * 100}%, rgba(255, 255, 255, 0.22) 0%, rgba(244, 63, 94, 0.08) 40%, transparent 70%)`,
        });
      }
    },
    [maxTilt, glare]
  );

  const handleMouseLeave = useCallback(() => {
    setTiltStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
    });
    if (glare) {
      setGlareStyle({
        opacity: 0,
      });
    }
  }, [glare]);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={tiltStyle}
      className={`tilt-card relative overflow-hidden transition-transform duration-350 ease-out select-none ${className}`}
      {...props}
    >
      {/* Specular Glare Layer */}
      {glare && (
        <div
          aria-hidden="true"
          style={glareStyle}
          className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-300 z-20"
        />
      )}
      <div className="tilt-inner relative z-10 w-full h-full">{children}</div>
    </div>
  );
}
