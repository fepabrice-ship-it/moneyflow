import { useState, useEffect } from 'react';
import { getTheme } from '../lib/theme';

// Renvoie le thème courant ('dark' | 'light') et se met à jour quand
// l'utilisateur bascule dans les Paramètres.
export const useTheme = () => {
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    const handler = (e) => setTheme(e.detail);
    window.addEventListener('theme-change', handler);
    return () => window.removeEventListener('theme-change', handler);
  }, []);

  return theme;
};
