import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Plus, 
  LayoutDashboard, 
  Receipt, 
  Settings,
  Wallet,
  LogOut,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const Dashboard = forwardRef((props, ref) => {
  const [safeToSpend, setSafeToSpend] = useState(0);
  const [spent, setSpent] = useState(0);
  const [obligations, setObligations] = useState(0);
  const [savingsGoal, setSavingsGoal] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      fetchData();
    }
  }));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Current month range (Local Date Strings YYYY-MM-DD)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      
      const startOfMonth = `${year}-${month}-01`;
      const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      // Parallel fetching
      const [obsRes, txRes, monthTxRes, profileRes] = await Promise.all([
        supabase.from('recurring_obligations').select('amount').eq('user_id', user.id).eq('is_active', true),
        supabase.from('transactions').select('*, categories(name, type)').eq('user_id', user.id).order('date', { ascending: false }).limit(5),
        supabase.from('transactions').select('*, categories(name, type)')
          .eq('user_id', user.id)
          .gte('date', startOfMonth)
          .lte('date', endOfMonth),
        supabase.from('profiles').select('monthly_savings_goal').eq('id', user.id).single()
      ]);

      const totalObligations = obsRes.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      setObligations(totalObligations);
      setSavingsGoal(profileRes.data?.monthly_savings_goal || 0);

      // Calculations for current month
      let monthlyIncome = 0;
      let monthlySpent = 0;

      monthTxRes.data?.forEach(tx => {
        const amount = Number(tx.amount);
        if (tx.type === 'income') {
          monthlyIncome += amount;
        } else {
          monthlySpent += amount;
        }
      });
      
      setSpent(monthlySpent);
      // Reste à Vivre = Income - Obligations - Spending
      setSafeToSpend(Math.max(0, monthlyIncome - totalObligations - monthlySpent));
      setRecentTransactions(txRes.data || []);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mt-1">Aperçu de vos finances</p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-8 glass-card bg-linear-to-br from-muted to-background relative overflow-hidden group min-h-[220px] flex flex-col justify-center">
          <div className="relative z-10">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Reste à Vivre</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-5xl md:text-6xl font-black tracking-tighter text-white">
                {new Intl.NumberFormat('fr-FR').format(safeToSpend)} FCFA
              </span>
            </div>
            <p className="mt-4 text-xs text-muted-foreground max-w-sm leading-relaxed">
              Votre budget disponible après obligations ({new Intl.NumberFormat('fr-FR').format(obligations)} FCFA) et dépenses.
            </p>
          </div>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full" />
        </div>

        <div className="col-span-12 md:col-span-4 grid gap-4">
          <div className="glass-card p-4">
            <span className="text-xs text-muted-foreground uppercase">Dépensé ce mois</span>
            <p className="text-xl font-bold mt-1 text-red-500">-{new Intl.NumberFormat('fr-FR').format(spent)} FCFA</p>
          </div>
          <div className="glass-card p-4">
            <span className="text-xs text-muted-foreground uppercase">Épargne Objectif</span>
            <p className="text-xl font-bold mt-1 text-primary">{new Intl.NumberFormat('fr-FR').format(savingsGoal)} FCFA</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Activité Récente</h2>
          <button 
            onClick={props.onViewAll}
            className="text-primary text-xs font-semibold uppercase tracking-widest flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
          >
            Tout voir
          </button>
        </div>
        <div className="space-y-3">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-muted-foreground'}`}>
                  {tx.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div>
                  <p className="font-semibold text-sm">{tx.description}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{tx.categories?.name || 'Général'}</p>
                </div>
              </div>
              <span className={`font-bold ${tx.type === 'income' ? 'text-green-500' : 'text-white'}`}>
                {tx.type === 'income' ? '+' : '-'}{new Intl.NumberFormat('fr-FR').format(tx.amount)} FCFA
              </span>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <div className="text-center py-10 text-muted-foreground italic">Aucune transaction trouvée.</div>
          )}
        </div>
      </section>
    </div>
  );
});

export default Dashboard;
