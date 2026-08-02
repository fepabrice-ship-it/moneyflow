// Gestion du thème clair/sombre.
// Le thème est stocké dans localStorage et appliqué via la classe `light`
// sur <html> (les variables sont surchargées dans index.css). Le sombre
// reste le thème par défaut.

const STORAGE_KEY = 'moneyflow-theme';

export const getTheme = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export const applyTheme = (theme) => {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme !== 'light');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // stockage indisponible : le thème vaudra pour la session en cours
  }
  // Prévient les composants qui dépendent du thème (graphiques Recharts…)
  window.dispatchEvent(new CustomEvent('theme-change', { detail: theme }));
};

// À appeler avant le premier rendu pour éviter un flash de mauvais thème.
export const initTheme = () => {
  const theme = getTheme();
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme !== 'light');
};
