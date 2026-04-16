import React from 'react';
import { X, TrendingUp, TrendingDown, Info, Calculator, PieChart } from 'lucide-react';

const CalculationDetailsModal = ({ isOpen, onClose, data, title = "Calcul Global" }) => {
  if (!isOpen) return null;

  const { incomeBreakdown, expenseBreakdown, totalIncome, totalExpense } = data;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-muted border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black">{title}</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Transparence des flux financiers</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 flex-1">
          {/* Summary Formula */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary text-center">Bilan Global</p>
            <div className="flex items-center justify-center gap-4 text-sm font-black">
              <span className="text-green-500">{new Intl.NumberFormat('fr-FR').format(totalIncome)} F</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-red-500">{new Intl.NumberFormat('fr-FR').format(totalExpense)} F</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-primary text-lg">{new Intl.NumberFormat('fr-FR').format(totalIncome - totalExpense)} F</span>
            </div>
          </div>

          {/* Breakdown Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income Section */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-green-500 flex items-center gap-2">
                <TrendingUp size={14} /> Revenus (Encaissements)
              </h3>
              <div className="space-y-2">
                {Object.entries(incomeBreakdown).map(([name, amount]) => (
                  <div key={name} className="p-3 bg-green-500/5 border border-green-500/10 rounded-2xl flex justify-between items-center">
                    <span className="text-xs font-bold text-white/80">{name}</span>
                    <span className="text-xs font-black text-green-500">+{new Intl.NumberFormat('fr-FR').format(amount)} F</span>
                  </div>
                ))}
                {Object.keys(incomeBreakdown).length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic text-center py-4">Aucun revenu.</p>
                )}
              </div>
            </div>

            {/* Expense Section */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                <TrendingDown size={14} /> Dépenses (Cash Out)
              </h3>
              <div className="space-y-2">
                {Object.entries(expenseBreakdown).map(([name, amount]) => (
                  <div key={name} className="p-3 bg-red-500/5 border border-red-500/10 rounded-2xl flex justify-between items-center">
                    <span className="text-xs font-bold text-white/80">{name}</span>
                    <span className="text-xs font-black text-red-500">-{new Intl.NumberFormat('fr-FR').format(amount)} F</span>
                  </div>
                ))}
                {Object.keys(expenseBreakdown).length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic text-center py-4">Aucune dépense.</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-3">
            <Info size={16} className="text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              Ce calcul est basé sur l'ensemble des transactions de la période et du secteur sélectionnés. Les types de catégories (Revenu/Dépense) sont définis lors de la configuration de votre projet.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-6 border-t border-white/5 bg-muted">
          <button
            onClick={onClose}
            className="w-full h-12 bg-white/10 hover:bg-white/15 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
          >
            Fermer l'aperçu
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalculationDetailsModal;
