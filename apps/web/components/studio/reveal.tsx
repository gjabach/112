'use client';
import { useEffect, useRef } from 'react';
import {
  motion,
  useReducedMotion,
  useAnimationControls,
  useInView,
} from 'framer-motion';
export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const inView = useInView(ref, { once: true, amount: 0.12 });
  useEffect(() => {
    if (reduced) {
      controls.set({ opacity: 1, y: 0 });
      return;
    }
    if (!inView) return;
    controls.set({ opacity: 0, y: 16 });
    void controls.start({
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] },
    });
  }, [controls, delay, inView, reduced]);
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={controls}
    >
      {children}
    </motion.div>
  );
}
