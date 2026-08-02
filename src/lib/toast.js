// Petit système de toast global : n'importe quel composant peut appeler
// showToast(), le composant <Toast /> (monté dans App) écoute et affiche.
// Pour un public peu à l'aise, le feedback visible après chaque action
// est essentiel — bien plus rassurant qu'une fermeture silencieuse.

export const showToast = (message, type = 'success') => {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
  // Petite vibration de confirmation sur mobile (ignorée si non supportée)
  try {
    if (type === 'success' && navigator.vibrate) navigator.vibrate(40);
  } catch {
    // rien : la vibration est un bonus
  }
};
