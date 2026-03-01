import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Target, 
  Plus, 
  Minus, 
  Loader2, 
  AlertCircle, 
  ChevronRight,
  TrendingUp,
  Receipt
} from 'lucide-react';

const Budgets = () => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [spendingByCat, setSpendingByCat] = useState({});
  const [showEdit, setShowEdit] = useState(null); // id of the category being edited
  const [editValue, setEditValue] = useState('');

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const fetchBudgetData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Local date range to avoid ISO/Timezone shifts
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const [catRes, budgetRes, txRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', currentMonth).eq('year', currentYear),
        supabase.from('transactions').select('amount, category_id').eq('user_id', user.id).gte('date', startOfMonth).lte('date', endOfMonth).eq('type', 'expense')
      ]);

      setCategories(catRes.data || []);
      
      const budgetMap = {};
      budgetRes.data?.forEach(b => {
        budgetMap[b.category_id] = b.amount;
      });
      setBudgets(budgetMap);

      const spendingMap = {};
      txRes.data?.forEach(tx => {
        spendingMap[tx.category_id] = (spendingMap[tx.category_id] || 0) + Number(tx.amount);
      });
      setSpendingByCat(spendingMap);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBudget = async (catId) => {
    if (!editValue) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const amount = parseFloat(editValue);
      
      const { error } = await supabase.from('budgets').upsert({
        user_id: user.id,
        category_id: catId,
        amount: amount,
        month: currentMonth,
        year: currentYear
      }, { onConflict: ['user_id', 'category_id', 'month', 'year'] });

      if (error) throw error;
      
      setBudgets({ ...budgets, [catId]: amount });
      setShowEdit(null);
      setEditValue('');
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Budgets Menusels</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-[10px] mt-1">Gérez vos limites par catégorie</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {categories.map((cat) => {
          const budgetLimit = budgets[cat.id] || 0;
          const spent = spendingByCat[cat.id] || 0;
          const remaining = budgetLimit - spent;
          const percentage = budgetLimit > 0 ? Math.min(100, (spent / budgetLimit) * 100) : 0;
          const isOver = spent > budgetLimit && budgetLimit > 0;

          return (
            <div key={cat.id} className="glass-card flex flex-col gap-4 group hover:border-white/10 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground">
                    <TrendingUp size={20} className={cat.type === 'obligation' ? 'text-primary' : ''} />
                  </div>
                  <div>
                    <h3 className="font-bold flex items-center gap-2">
                      {cat.name}
                      {cat.type === 'obligation' && <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase tracking-tighter font-black">Fixe</span>}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {budgetLimit > 0 
                        ? `${new Intl.NumberFormat('fr-FR').format(spent)} / ${new Intl.NumberFormat('fr-FR').format(budgetLimit)} FCFA` 
                        : "Aucun budget défini"}
                    </p>
                  </div>
                </div>

                {showEdit === cat.id ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      autoFocus
                      className="bg-background border border-white/10 rounded-lg px-2 py-1 text-sm w-24 outline-none focus:border-primary"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Budget"
                    />
                    <button onClick={() => handleUpdateBudget(cat.id)} className="p-2 bg-primary text-white rounded-lg hover:opacity-90 cursor-pointer">
                      OK
                    </button>
                    <button onClick={() => setShowEdit(null)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer">
                      <Plus className="rotate-45" size={16} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setShowEdit(cat.id);
                      setEditValue(budgetLimit.toString());
                    }}
                    className="p-2 bg-white/5 rounded-lg text-muted-foreground hover:text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    Définir Budget
                  </button>
                )}
              </div>

              {/* Progress Bar Container */}
              {budgetLimit > 0 && (
                <div className="space-y-3">
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${
                        isOver ? 'bg-red-500' : percentage > 80 ? 'bg-orange-500' : 'bg-primary'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className={isOver ? 'text-red-500' : 'text-muted-foreground'}>
                      {isOver ? 'Budget Dépassé' : `Utilisé: ${Math.round(percentage)}%`}
                    </span>
                    <span className={remaining < 0 ? 'text-red-500' : 'text-green-500'}>
                      Reste: {new Intl.NumberFormat('fr-FR').format(Math.abs(remaining))} FCFA
                      {remaining < 0 ? ' (En trop)' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Budgets;
