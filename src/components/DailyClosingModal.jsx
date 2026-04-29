import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, CheckCircle2, Calculator, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';

const DailyClosingModal = ({ isOpen, onClose, onRefresh }) => {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [theoreticalAmount, setTheoreticalAmount] = useState(0);
  const [declaredAmount, setDeclaredAmount] = useState('');
  const [step, setStep] = useState(1); // 1: Calculation, 2: Result

  useEffect(() => {
    if (isOpen && currentProject) {
      calculateTheoretical();
    }
  }, [isOpen, currentProject]);

  const calculateTheoretical = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      // Sum all income transactions for today that are NOT internal/exclude
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

  const handleSubmit = async (e) => {
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
      
      if (onRefresh) onRefresh();
      onClose();
      setStep(1);
      setDeclaredAmount('');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const difference = parseFloat(declaredAmount || 0) - theoreticalAmount;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-muted border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="text-lg font-bold">Clôture de Caisse</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {step === 1 ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="p-6 bg-white/5 rounded-3xl border border-white/5 text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Ventes Attendues (Théorique)</p>
                <p className="text-4xl font-black text-white tracking-tighter">
                  {new Intl.NumberFormat('fr-FR').format(theoreticalAmount)} <span className="text-lg">FCFA</span>
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground ml-1">Cash Physique en Caisse</label>
                <div className="relative">
                  <Calculator className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} />
                  <input 
                    autoFocus
                    required
                    type="number"
                    value={declaredAmount}
                    onChange={(e) => setDeclaredAmount(e.target.value)}
                    placeholder="Montant compté..."
                    className="w-full bg-background border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xl font-black focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                Calculer l'écart <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right duration-300">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${difference === 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  {difference === 0 ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-black">{difference === 0 ? 'Caisse Parfaite !' : 'Écart Détecté'}</h3>
                  <p className="text-sm text-muted-foreground">Comparaison entre réel et théorique</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Écart</p>
                  <p className={`text-lg font-black ${difference >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {difference > 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(difference)} FCFA
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                  <p className="text-sm font-bold uppercase italic">
                    {difference === 0 ? 'Conforme' : difference > 0 ? 'Surplus' : 'Manquant'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-xs transition-all"
                >
                  Corriger
                </button>
                <button 
                  disabled={loading}
                  onClick={handleConfirm}
                  className="flex-2 py-4 bg-white text-black rounded-2xl font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Valider la Clôture</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyClosingModal;
