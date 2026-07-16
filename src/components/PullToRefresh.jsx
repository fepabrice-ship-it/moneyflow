import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';

// Composant générique de pull-to-refresh pour mobile.
//   - Détecte uniquement quand on est tout en haut (scrollY === 0)
//   - L'utilisateur tire vers le bas, un indicateur apparaît et grossit
//   - À partir d'un seuil (THRESHOLD), relâcher déclenche onRefresh()
//   - Indicateur reste visible pendant le chargement puis disparait
//   - Implémentation 100% JS/touch — compatible Capacitor sans plugin natif
//
// L'évènement global 'refresh-data' est dispatché en plus de l'appel
// `onRefresh()`, pour que tous les composants qui écoutent
// `useRefreshTrigger` se rafraîchissent en cascade.

const THRESHOLD = 70;      // distance (px) à dépasser pour déclencher
const MAX_PULL = 120;      // limite visuelle pour éviter un étirement infini
const RESIST_FACTOR = 0.5; // résistance : on tire 2px pour 1px d'affichage

const PullToRefresh = ({ onRefresh, children, disabled = false }) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const armed = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (disabled || refreshing) return;
    // Seul un toucher démarrant en haut de la page nous intéresse
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    armed.current = true;
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!armed.current || startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      // Si l'utilisateur remonte ou ne tire pas vers le bas, on désarme
      if (pull > 0) setPull(0);
      return;
    }
    // On applique la résistance pour un feel naturel
    const visual = Math.min(MAX_PULL, dy * RESIST_FACTOR);
    setPull(visual);
  }, [pull]);

  const handleTouchEnd = useCallback(async () => {
    if (!armed.current) return;
    armed.current = false;
    startY.current = null;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      try {
        // Dispatch global pour réveiller tous les composants abonnés au
        // useRefreshTrigger (Dashboard, Statistics, Inventory, Leaderboard…)
        window.dispatchEvent(new CustomEvent('refresh-data'));
        if (onRefresh) await onRefresh();
      } finally {
        // Petit délai pour que l'utilisateur voie l'indicateur "loader"
        setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 400);
      }
    } else {
      setPull(0);
    }
  }, [pull, refreshing, onRefresh]);

  // Ratio 0..1 pour animer l'icône en fonction de la progression
  const progress = Math.min(1, pull / THRESHOLD);
  const armed_for_release = pull >= THRESHOLD;

  // Bloque la vraie barre d'overscroll du navigateur quand on tire
  // (évite que le navigateur tente sa propre pull-to-refresh par-dessus).
  useEffect(() => {
    const el = document.documentElement;
    if (pull > 0 || refreshing) {
      el.style.overscrollBehaviorY = 'contain';
    } else {
      el.style.overscrollBehaviorY = '';
    }
  }, [pull, refreshing]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Indicateur de pull */}
      <div
        className="fixed left-0 right-0 z-[200] flex items-center justify-center pointer-events-none"
        style={{
          top: 0,
          height: `${pull}px`,
          opacity: pull / THRESHOLD,
          transition: refreshing || pull === 0 ? 'all 0.3s ease' : 'none',
        }}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-xl border ${
          armed_for_release ? 'bg-primary text-white border-primary/40' : 'bg-muted/80 text-muted-foreground border-white/10'
        }`}>
          {refreshing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <ArrowDown
              size={18}
              style={{
                transform: `rotate(${armed_for_release ? 180 : progress * 180}deg)`,
                transition: 'transform 0.15s ease',
              }}
            />
          )}
        </div>
      </div>

      {/* Contenu décalé par la quantité de pull */}
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: refreshing || pull === 0 ? 'transform 0.3s ease' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
