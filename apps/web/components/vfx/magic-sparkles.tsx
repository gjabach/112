'use client';

import React from 'react';

interface SparkleProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export function SparkleIcon({ size = 16, color = 'currentColor', style }: SparkleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="inline-block animate-pulse-slow shrink-0"
      style={style}
    >
      <path
        d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
        fill={color}
      />
    </svg>
  );
}

interface MagicSparklesProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}

export function MagicSparkles({ children, active = true, className = '' }: MagicSparklesProps) {
  if (!active) return <>{children}</>;

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      {/* Top right sparkle */}
      <span className="absolute -top-1.5 -right-1.5 pointer-events-none z-10 animate-float" style={{ animationDelay: '0.2s' }}>
        <SparkleIcon size={11} color="#f59e0b" />
      </span>

      {/* Bottom left sparkle */}
      <span className="absolute -bottom-1 -left-1.5 pointer-events-none z-10 animate-pulse-slow" style={{ animationDelay: '0.8s' }}>
        <SparkleIcon size={9} color="#a855f7" />
      </span>

      {children}
    </span>
  );
}

export function GlowingDot({ color = 'bg-primary', ping = true }: { color?: string; ping?: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {ping && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}
