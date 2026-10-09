import React from 'react';
export function SparkleIcon({
  size = 16,
  color = 'currentColor',
  style,
}: {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      className="inline-block shrink-0"
      aria-hidden="true"
    >
      <path
        d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function MagicSparkles({
  children,
  className = '',
}: {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center ${className}`}>{children}</span>
  );
}
export function GlowingDot({
  color = 'bg-primary',
  className = '',
}: {
  color?: string;
  ping?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-2 w-2 shrink-0 rounded-full ${color} ${className}`}
    />
  );
}
