import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// Le splash reste affiché tant que :
//   - la durée minimale (effet de marque) n'est pas écoulée, ET
//   - les données initiales (`ready`) ne sont pas chargées.
// Comme ça l'utilisateur n'attend qu'UNE fois au lieu de splash + loader.
const MIN_DURATION_MS = 1500;
const MAX_DURATION_MS = 5000; // garde-fou : on dégage le splash même si data tarde

const SplashScreen = ({ onComplete, ready = true }) => {
  const [minElapsed, setMinElapsed] = useState(false);
  const [forceDone, setForceDone] = useState(false);

  useEffect(() => {
    const minT = setTimeout(() => setMinElapsed(true), MIN_DURATION_MS);
    const maxT = setTimeout(() => setForceDone(true), MAX_DURATION_MS);
    return () => { clearTimeout(minT); clearTimeout(maxT); };
  }, []);

  useEffect(() => {
    if (forceDone || (minElapsed && ready)) onComplete();
  }, [minElapsed, ready, forceDone, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
      className="fixed inset-0 z-[1000] bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-6">
        {/* Logo */}
        <motion.img
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          src="/logo.png"
          alt="MoneyFlow"
          className="w-28 h-28 rounded-[2rem] object-contain drop-shadow-2xl"
        />

        {/* Brand Text (single, clean — no duplicate) */}
        <motion.h1
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="text-4xl font-black tracking-tighter text-white"
        >
          Money<span className="text-primary">Flow</span>
        </motion.h1>

        {/* Loading Indicator */}
        <div className="mt-2 w-40 h-[2px] bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.4 }}
            className="w-full h-full bg-gradient-to-r from-transparent via-primary to-transparent"
          />
        </div>
      </div>

      {/* Version Tag */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute bottom-10 text-[10px] text-white/20 font-medium tracking-widest uppercase"
      >
        Version 1.4.0 • Brayce Edition
      </motion.div>
    </motion.div>
  );
};

export default SplashScreen;
