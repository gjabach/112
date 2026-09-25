'use client';

import React, { useEffect, useRef } from 'react';

export interface ConfettiOptions {
  type?: 'celebration' | 'stardust' | 'milestone';
  origin?: { x: number; y: number }; // Relative coordinates [0..1]
  particleCount?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  shape: 'rect' | 'circle' | 'star';
}

const PALETTES = {
  celebration: ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#e11d48'],
  stardust: ['#fbbf24', '#f59e0b', '#fde68a', '#e0e7ff', '#c084fc', '#ffffff'],
  milestone: ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ffffff'],
};

// Global event bus for firing confetti from anywhere
const CONFETTI_EVENT = 'novelist-trigger-confetti';

export function fireConfetti(options?: ConfettiOptions) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONFETTI_EVENT, { detail: options || {} }));
  }
}

export function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationId: number | null = null;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnParticles = (opts: ConfettiOptions) => {
      const type = opts.type || 'celebration';
      const count = opts.particleCount || (type === 'milestone' ? 80 : 50);
      const originX = (opts.origin?.x ?? 0.5) * canvas.width;
      const originY = (opts.origin?.y ?? 0.4) * canvas.height;
      const colors = PALETTES[type] || PALETTES.celebration;

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (type === 'stardust' ? 6 : 12) + 3;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const shapeRand = Math.random();
        const shape = shapeRand < 0.4 ? 'circle' : shapeRand < 0.8 ? 'rect' : 'star';

        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (type === 'stardust' ? 1 : 4),
          rotation: Math.random() * 360,
          vRot: (Math.random() - 0.5) * 10,
          color,
          size: Math.random() * 6 + (type === 'stardust' ? 2 : 4),
          alpha: 1,
          decay: Math.random() * 0.015 + 0.01,
          shape,
        });
      }

      if (!animationId) {
        loop();
      }
    };

    const drawStar = (cx: number, cy: number, spikes: number, outerR: number, innerR: number) => {
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerR);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerR;
        y = cy + Math.sin(rot) * outerR;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerR;
        y = cy + Math.sin(rot) * innerR;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerR);
      ctx.closePath();
      ctx.fill();
    };

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.vx *= 0.98; // air resistance
        p.rotation += p.vRot;
        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.y > canvas.height + 20) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(0, 0, 5, p.size, p.size * 0.5);
        }

        ctx.restore();
      }

      if (particles.length > 0) {
        animationId = requestAnimationFrame(loop);
      } else {
        animationId = null;
      }
    };

    const handleTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<ConfettiOptions>;
      spawnParticles(customEvent.detail || {});
    };

    window.addEventListener(CONFETTI_EVENT, handleTrigger);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener(CONFETTI_EVENT, handleTrigger);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999] select-none"
      aria-hidden="true"
    />
  );
}
