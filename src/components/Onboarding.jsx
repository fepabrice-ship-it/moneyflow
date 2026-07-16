import React, { useState } from 'react';
import { 
  Rocket, 
  ChevronRight, 
  Target, 
  RefreshCcw, 
  TrendingUp,
  Loader2
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('standard');
  const [loading, setLoading] = useState(false);
  const { createProject } = useProject();

  const types = [
    {
      id: 'standard',
      name: 'Standard',
      icon: Target,
      desc: 'Gère ton argent du mois (salaire, argent de poche, etc.) chaque mois simplement.',
      details: 'Chaque nouveau mois recommence à zéro, et tu dois définir ton budget du mois.',
      color: 'blue'
    },
    {
      id: 'continuous',
      name: 'Business',
      icon: RefreshCcw,
      desc: 'Suis l’argent de ton activité au quotidien.',
      details: 'L’argent restant continue le mois suivant.',
      color: 'green'
    }
  ];

  const handleLaunch = async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      await createProject(projectName, projectType);
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
          <p className="text-muted-foreground uppercase tracking-[0.2em] text-[10px] font-bold">
            Commençons l'aventure ensemble
          </p>
        </div>

        <div className="glass-card p-8 space-y-8 border-white/10 shadow-2xl">
          {step === 1 ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold italic">Donnez un nom à votre premier projet</h2>
                <p className="text-xs text-muted-foreground leading-relaxed px-8">
                  Que ce soit pour vos dépenses perso ou un business, chaque voyage commence par un nom.
                </p>
              </div>
              
              <div className="space-y-2">
                <input
                  type="text"
                  autoFocus
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && projectName && setStep(2)}
                  placeholder="Ex: Commerce, Vente, Finances..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-xl font-bold text-center focus:border-primary outline-none transition-all placeholder:text-white/20"
                />
              </div>

              <button
                disabled={!projectName}
                onClick={() => setStep(2)}
                className="w-full bg-white text-black h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-30 cursor-pointer"
              >
                Suivant
                <ChevronRight size={20} />
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold italic">Quelle est la logique du projet ?</h2>
                <p className="text-xs text-muted-foreground px-4">
                  Choisissez comment MoneyFlow doit calculer vos soldes.
                </p>
              </div>

              <div className="space-y-3">
                {types.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setProjectType(t.id)}
                    className={`w-full flex items-start gap-4 p-4 rounded-2xl border transition-all text-left group ${
                      projectType === t.id 
                      ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10 scale-[1.02]' 
                      : 'bg-white/5 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className={`mt-1 p-2 rounded-xl shrink-0 transition-colors ${
                      projectType === t.id ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground'
                    }`}>
                      <t.icon size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-sm flex items-center gap-2">
                        {t.name}
                        {projectType === t.id && (
                          <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase tracking-tighter">Sélectionné</span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                      <p className={`text-[9px] mt-2 font-medium transition-all ${
                        projectType === t.id ? 'text-primary' : 'text-blue-400 opacity-0 group-hover:opacity-100'
                      }`}>
                        {t.details}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-4 flex gap-3">
  <button
    onClick={() => setStep(1)}
    className="px-4 h-11 rounded-xl font-medium text-sm bg-white/5 text-muted-foreground hover:bg-white/10 transition-all"
  >
    Retour
  </button>

  <button
    onClick={handleLaunch}
    disabled={loading}
    className="flex-1 bg-primary text-white h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
  >
    {loading ? (
      <Loader2 className="animate-spin" size={18} />
    ) : (
      <>
        Lancer
        <Rocket size={16} />
      </>
    )}
  </button>
</div>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-medium opacity-50">
          Vous pourrez changer ces paramètres plus tard.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
