'use client';

import React from 'react';

interface AmbientBackgroundProps {
  intensity?: 'subtle' | 'medium' | 'high';
  className?: string;
}

export function AmbientBackground({ intensity = 'subtle', className = '' }: AmbientBackgroundProps) {
  const opacityMap = {
    subtle: 'opacity-30 dark:opacity-20',
    medium: 'opacity-50 dark:opacity-35',
    high: 'opacity-70 dark:opacity-50',
  };

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden z-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* Primary breathing aurora orb (Top-left / Violet) */}
      <div
        className={`absolute -top-32 -left-32 w-96 h-96 md:w-[600px] md:h-[600px] rounded-full blur-3xl mix-blend-normal transition-opacity duration-1000 animate-pulse-slow ${opacityMap[intensity]}`}
        style={{
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, hsl(280 80% 60% / 0.2) 50%, transparent 75%)',
        }}
      />

      {/* Secondary accent orb (Top-right / Rose & Fuchsia) */}
      <div
        className={`absolute top-1/4 -right-40 w-80 h-80 md:w-[500px] md:h-[500px] rounded-full blur-3xl mix-blend-normal transition-opacity duration-1000 animate-float ${opacityMap[intensity]}`}
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.35) 0%, rgba(168, 85, 247, 0.2) 50%, transparent 75%)',
          animationDelay: '-2.5s',
        }}
      />

      {/* Tertiary subtle warm orb (Bottom-center / Amber & Indigo) */}
      <div
        className={`absolute -bottom-40 left-1/3 w-80 h-80 md:w-[600px] md:h-[600px] rounded-full blur-3xl mix-blend-normal transition-opacity duration-1000 animate-pulse-slow ${opacityMap[intensity]}`}
        style={{
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, rgba(99, 102, 241, 0.15) 50%, transparent 75%)',
          animationDelay: '-4s',
        }}
      />

      {/* Delicate stardust grid texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />
    </div>
  );
}
