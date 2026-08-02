import { Capacitor } from '@capacitor/core';

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

// Barre de statut Android : fond assorti au thème, et surtout le bon style
// d'icônes (Style.Dark = fond sombre → icônes CLAIRES ; Style.Light = fond
// clair → icônes sombres). Sans ça, heure/wifi/batterie sont illisibles.
const syncStatusBar = async (theme) => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setBackgroundColor({ color: theme === 'light' ? '#f3f4f6' : '#0a0a0a' });
    await StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark });
  } catch {
    // plugin absent (web) ou API indisponible : sans gravité
  }
};

const applyDomTheme = (theme) => {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme !== 'light');
};

export const applyTheme = (theme) => {
  applyDomTheme(theme);
  syncStatusBar(theme);
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
  applyDomTheme(theme);
  syncStatusBar(theme);
};
