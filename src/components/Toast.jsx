import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

// Affiche les toasts émis via lib/toast.js. Monté une seule fois dans App.
const Toast = () => {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      setToast(e.detail);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), 2800);
    };
    window.addEventListener('app-toast', handler);
    return () => {
      window.removeEventListener('app-toast', handler);
      clearTimeout(timer.current);
    };
  }, []);

  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[900] w-[calc(100%-3rem)] max-w-sm pointer-events-none">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 fade-in duration-300 ${
        isError
          ? 'bg-red-500/15 border-red-500/30 text-red-500'
          : 'bg-green-500/15 border-green-500/30 text-green-500'
      }`}>
        {isError ? <AlertCircle size={20} className="shrink-0" /> : <CheckCircle2 size={20} className="shrink-0" />}
        <p className="text-sm font-bold text-foreground leading-snug">{toast.message}</p>
      </div>
    </div>
  );
};

export default Toast;
