import React from 'react';
import { motion } from 'framer-motion';

const ORBS = [
  { size: 280, x: '8%', y: '15%', delay: 0, duration: 18 },
  { size: 200, x: '75%', y: '10%', delay: 2, duration: 22 },
  { size: 160, x: '85%', y: '65%', delay: 1, duration: 16 },
  { size: 220, x: '20%', y: '70%', delay: 3, duration: 20 },
];

const LINES = [
  { top: '22%', width: '140%', duration: 28 },
  { top: '48%', width: '120%', duration: 34 },
  { top: '72%', width: '130%', duration: 30 },
];

export default function ShopHeroMotion() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {ORBS.map((orb, i) => (
        <motion.div
          key={`orb-${i}`}
          className="absolute rounded-full bg-white/10 blur-3xl"
          style={{ width: orb.size, height: orb.size, left: orb.x, top: orb.y }}
          animate={{
            x: [0, 24, -16, 0],
            y: [0, -20, 12, 0],
            scale: [1, 1.08, 0.95, 1],
            opacity: [0.35, 0.55, 0.4, 0.35],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {LINES.map((line, i) => (
        <motion.div
          key={`line-${i}`}
          className="absolute h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          style={{ top: line.top, width: line.width, left: '-20%' }}
          animate={{ x: ['0%', '15%', '0%'] }}
          transition={{
            duration: line.duration,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 1.5,
          }}
        />
      ))}

      <motion.div
        className="absolute -right-20 top-1/4 w-72 h-72 rounded-full border border-white/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute -left-16 bottom-1/4 w-56 h-56 rounded-full border border-white/5"
        animate={{ rotate: -360 }}
        transition={{ duration: 56, repeat: Infinity, ease: 'linear' }}
      />

      <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
      <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_80%_60%,#22d3ee,transparent_45%)]" />
    </div>
  );
}
