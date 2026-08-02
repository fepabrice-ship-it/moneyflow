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

// Barre de statut Android. Depuis Android 15/16, colorer la barre est interdit
// (edge-to-edge imposé, setBackgroundColor ignoré). La seule approche fiable :
// l'app dessine DERRIÈRE la barre (overlay) — son fond est alors celui de la
// page, donc toujours assorti au thème — et l'interface se décale de la
// hauteur de la barre via la variable CSS --status-bar-height.
// Le style d'icônes reste piloté ici (Style.Dark = icônes claires, et vice
// versa), sinon heure/wifi/batterie sont illisibles.
const syncStatusBar = async (theme) => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark });
    let height = 28; // repli raisonnable si l'info n'est pas disponible
    try {
      const info = await StatusBar.getInfo();
      if (Number(info?.height) > 0) height = Number(info.height);
    } catch { /* on garde le repli */ }
    document.documentElement.style.setProperty('--status-bar-height', `${height}px`);
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
