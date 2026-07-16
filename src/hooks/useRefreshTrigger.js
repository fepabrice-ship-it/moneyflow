import { useState, useEffect } from 'react';

// Hook qui écoute l'évènement global 'refresh-data' dispatché par
// `App.handleRefresh()` (et le pull-to-refresh). À ajouter dans les
// dépendances d'un useEffect de fetch : chaque incrémentation du tick
// déclenchera le re-fetch automatiquement.
//
// Usage:
//   const refreshTick = useRefreshTrigger();
//   useEffect(() => { fetchData(); }, [currentProject, refreshTick]);
export const useRefreshTrigger = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener('refresh-data', handler);
    return () => window.removeEventListener('refresh-data', handler);
  }, []);
  return tick;
};

// Helper pour émettre l'évènement depuis n'importe où.
export const triggerGlobalRefresh = () => {
  window.dispatchEvent(new CustomEvent('refresh-data'));
};
