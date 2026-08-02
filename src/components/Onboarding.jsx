import React, { useState } from 'react';
import { Rocket, ChevronRight, Loader2 } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

// Onboarding en 2 étapes, pensé pour des utilisateurs peu à l'aise :
//   1. D'abord la question concrète (« Tu veux suivre quoi ? ») avec deux
//      grandes cartes illustrées — pas de jargon type « Standard ».
//   2. Ensuite un nom PRÉ-REMPLI selon le choix : on peut valider tel quel,
//      aucune page blanche bloquante.
const TYPES = [
  {
    id: 'continuous',
    emoji: '💼',
    name: 'Mon commerce',
    desc: 'Boutique, ventes, marchandises… Je suis l’argent de mon activité.',
    defaultName: 'Mon commerce',
  },
  {
    id: 'standard',
    emoji: '🏠',
    name: 'Mon argent personnel',
    desc: 'Salaire, dépenses du mois… Je gère mon argent de tous les jours.',
    defaultName: 'Mes dépenses',
  },
];

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState(null);
  const [loading, setLoading] = useState(false);
  const { createProject } = useProject();

  const selectedType = TYPES.find(t => t.id === projectType);

  const chooseType = (t) => {
    setProjectType(t.id);
    // Nom proposé par défaut — modifiable à l'étape suivante.
    setProjectName(t.defaultName);
    setStep(2);
  };

  const handleLaunch = async () => {
    if (!projectName.trim()) return;
    setLoading(true);
    try {
      await createProject(projectName.trim(), projectType);
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-xl w-full space-y-8 relative z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4 animate-bounce">
            <Rocket size={32} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Bienvenue sur <span className="text-primary">MoneyFlow</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Suis ton argent, simplement.
          </p>
        </div>

        <div className="glass-card p-6 sm:p-8 space-y-6 border-white/10 shadow-2xl">
          {step === 1 ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-1 text-center">
                <h2 className="text-xl font-bold">Tu veux suivre quoi ?</h2>
                <p className="text-sm text-muted-foreground">Choisis ce qui te correspond. Tu pourras en créer d'autres après.</p>
              </div>

              <div className="space-y-3">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => chooseType(t)}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl border bg-white/5 border-white/10 hover:border-primary/50 active:scale-[0.98] transition-all text-left group"
                  >
                    <span className="text-4xl shrink-0">{t.emoji}</span>
                    <div className="flex-1">
                      <p className="font-black text-base">{t.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{t.desc}</p>
                    </div>
                    <ChevronRight size={20} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-1 text-center">
                <span className="text-4xl">{selectedType?.emoji}</span>
                <h2 className="text-xl font-bold">Donne-lui un nom</h2>
                <p className="text-sm text-muted-foreground">
                  On t'en propose un — tu peux le garder ou le changer.
                </p>
              </div>

              <input
                type="text"
                autoFocus
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => e.key === 'Enter' && projectName.trim() && handleLaunch()}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-xl font-bold text-center focus:border-primary outline-none transition-all"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 h-14 rounded-2xl font-bold text-sm bg-white/5 text-muted-foreground hover:bg-white/10 transition-all"
                >
                  Retour
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={loading || !projectName.trim()}
                  className="flex-1 bg-primary text-primary-foreground h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      C'est parti
                      <Rocket size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground opacity-60">
          Tu pourras changer tout ça plus tard dans les Paramètres.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
