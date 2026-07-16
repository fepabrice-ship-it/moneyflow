import React, { useState, useEffect } from 'react';
import { Calculator, ArrowRight, Save, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';

const DailyClosingSection = () => {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [theoreticalAmount, setTheoreticalAmount] = useState(0);
  const [declaredAmount, setDeclaredAmount] = useState('');
  const [step, setStep] = useState(1); // 1: Input, 2: Result
  const [lastClosing, setLastClosing] = useState(null);

  useEffect(() => {
    if (currentProject) {
      fetchTheoretical();
      fetchLastClosing();
    }
  }, [currentProject]);

  const fetchTheoretical = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('project_id', currentProject.id)
        .eq('type', 'income')
        .eq('date', today)
        .eq('payment_status', 'paid')
        .eq('exclude_from_global', false);

      if (error) throw error;
      const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
      setTheoreticalAmount(total);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLastClosing = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_closings')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('date', { ascending: false })
        .limit(1)
        .single();
      
      if (data) setLastClosing(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const diff = parseFloat(declaredAmount) - theoreticalAmount;
      
      const { error } = await supabase
        .from('daily_closings')
        .insert([{
          project_id: currentProject.id,
          user_id: user.id,
          declared_amount: parseFloat(declaredAmount),
          theoretical_amount: theoreticalAmount,
          difference: diff,
          date: new Date().toISOString().split('T')[0]
        }]);

      if (error) throw error;
      
      alert('Point de caisse enregistré avec succès !');
      setStep(1);
      setDeclaredAmount('');
      fetchLastClosing();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject || currentProject.type !== 'continuous') return null;

  const difference = parseFloat(declaredAmount || 0) - theoreticalAmount;

  return (
    <div className="glass-card space-y-6">
      <div className="flex items-center gap-3 text-primary">
        <Calculator size={20} />
        <h2 className="font-bold">Point de Caisse & Fermeture</h2>
      </div>

      <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
        <div className="flex gap-3">
          <Info size={16} className="text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-white uppercase tracking-wider">Pourquoi faire le point ?</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Cette section vous permet de vérifier que l'argent réel dans votre caisse correspond aux ventes enregistrées. 
              C'est essentiel pour détecter les erreurs de rendu de monnaie ou les oublis.
            </p>
          </div>
        </div>
      </div>

      {step === 1 ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Ventes Théoriques (Aujourd'hui)</p>
              <p className="text-xl font-black text-white">
                {new Intl.NumberFormat('fr-FR').format(theoreticalAmount)} FCFA
              </p>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Argent Réel en Caisse</label>
              <div className="relative">
                <input
                  required
                  type="number"
                  value={declaredAmount}
                  onChange={(e) => setDeclaredAmount(e.target.value)}
                  className="w-full bg-background border border-white/5 rounded-xl py-2.5 px-4 text-sm font-bold focus:border-primary outline-none transition-all"
                  placeholder="Ex: 50000"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">FCFA</div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-white h-12 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            Vérifier l'Écart <ArrowRight size={16} />
          </button>
        </form>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Écart détecté</p>
              <p className={`text-2xl font-black ${difference === 0 ? 'text-green-500' : 'text-red-500'}`}>
                {difference > 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(difference)} FCFA
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${difference === 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
              {difference === 0 ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 h-12 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Corriger
            </button>
            <button
              disabled={loading}
              onClick={handleConfirm}
              className="flex-[2] bg-white text-black h-12 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Valider la Fermeture</>}
            </button>
          </div>
        </div>
      )}

      {lastClosing && (
        <div className="pt-4 border-t border-white/5">
          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Dernière fermeture enregistrée</p>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">{new Date(lastClosing.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
            <span className={`font-bold ${lastClosing.difference === 0 ? 'text-green-500' : 'text-red-500'}`}>
              Écart: {lastClosing.difference > 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(lastClosing.difference)} FCFA
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyClosingSection;
