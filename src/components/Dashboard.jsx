import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Calendar,
  Globe,
  Info,
  Layers,
  User,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';

const Dashboard = (props) => {
  const { currentProject, members } = useProject();
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'global'
  const [memberFilter, setMemberFilter] = useState('all');
  const [safeToSpend, setSafeToSpend] = useState(0);
  const [spent, setSpent] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [investmentBalance, setInvestmentBalance] = useState(0); // Capital - All Expenses
  const [carryOver, setCarryOver] = useState(0);
  const [obligations, setObligations] = useState(0);
  const [savingsGoal, setSavingsGoal] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default to Global view for continuous flow projects
  useEffect(() => {
    if (currentProject?.type === 'continuous') {
      setViewMode('global');
    } else {
      setViewMode('monthly');
    }
  }, [currentProject?.id]);

  useEffect(() => {
    if (currentProject) {
      fetchData();
    }
  }, [currentProject, viewMode, memberFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const year = now.getFullYear();
      const monthNum = now.getMonth() + 1;
      const monthStr = String(monthNum).padStart(2, '0');
      const startOfMonth = `${year}-${monthStr}-01`;
      
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endOfMonth = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      // Build recent transactions query with member filter
      let recentQuery = supabase.from('transactions')
        .select('*, categories(name, type), profiles:user_id(full_name)')
        .eq('project_id', currentProject.id)
        .order('date', { ascending: false });
      
      if (memberFilter !== 'all') {
        recentQuery = recentQuery.eq('user_id', memberFilter);
      }

      // Fetch all relevant data for the project
      // Note: Getting category names for all transactions to detect 'Vente' vs 'Investissement'
      const [obsRes, txRes, txAllRes, profileRes] = await Promise.all([
        supabase.from('recurring_obligations')
          .select('amount')
          .eq('project_id', currentProject.id)
          .eq('is_active', true),
        recentQuery.limit(5),
        supabase.from('transactions')
          .select('*, categories(name)')
          .eq('project_id', currentProject.id),
        supabase.from('profiles')
          .select('monthly_savings_goal')
          .eq('id', currentProject.owner_id)
          .single()
      ]);

      const totalObligations = obsRes.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      setObligations(totalObligations);
      setSavingsGoal(profileRes.data?.monthly_savings_goal || 0);

      const allTransactions = txAllRes.data || [];
      
      // Filter base transactions by member if applicable
      const baseFilteredTransactions = memberFilter === 'all' 
        ? allTransactions 
        : allTransactions.filter(tx => tx.user_id === memberFilter);

      // --- LOGIC: DUAL TRACKING + INVESTMENT BALANCE ---
      // 1. CASH FLOW (What is in the pocket? EVERYTHING counts)
      let cashMonthlyInc = 0;
      let cashMonthlySp = 0;
      let cashPastInc = 0;
      let cashPastSp = 0;
      let cashGlobalInc = 0;
      let cashGlobalSp = 0;

      // 2. PERFORMANCE (What did we EARN? Excludes capital/transfers)
      let perfMonthlyInc = 0;
      let perfMonthlySp = 0;
      let perfGlobalInc = 0;
      let perfGlobalSp = 0;

      // 3. INVESTMENT LOGIC (Using categories as requested)
      let capitalInGlobal = 0;
      let absoluteTotalSpent = 0;

      baseFilteredTransactions.forEach(tx => {
        const amount = Number(tx.amount);
        const isIncome = tx.type === 'income';
        const isExclude = tx.exclude_from_global === true;
        const txDate = tx.date;
        const catName = tx.categories?.name;
        
        const isPast = txDate < startOfMonth;
        const isCurrentMonth = txDate >= startOfMonth && txDate <= endOfMonth;

        // CASH FLOW CALCULATION (Wallet accuracy)
        if (isIncome) {
          cashGlobalInc += amount;
          if (isCurrentMonth) cashMonthlyInc += amount;
          else if (isPast) cashPastInc += amount;
          
          if (catName === 'Investissement' || isExclude) {
            capitalInGlobal += amount;
          }
        } else {
          cashGlobalSp += amount;
          if (isCurrentMonth) cashMonthlySp += amount;
          else if (isPast) cashPastSp += amount;
          
          absoluteTotalSpent += amount;
        }

      // PERFORMANCE CALCULATION (ROI/Business accuracy - Matches TransactionsList logic EXACTLY)
        // We only exclude transactions the user manually flagged as 'Internal/Technical'
        if (!isExclude) {
          if (isIncome) {
            perfGlobalInc += amount;
            if (isCurrentMonth) perfMonthlyInc += amount;
          } else {
            perfGlobalSp += amount;
            if (isCurrentMonth) perfMonthlySp += amount;
          }
        }
      });

      const computedCarryOver = cashPastInc - cashPastSp;
      setCarryOver(computedCarryOver);
      setInvestmentBalance(capitalInGlobal - absoluteTotalSpent);
      
      if (viewMode === 'monthly') {
        const baseBalance = currentProject.type === 'continuous' ? computedCarryOver : 0;
        // Wallet balance
        setSafeToSpend(baseBalance + cashMonthlyInc - totalObligations - cashMonthlySp);
        // Displayed Performance Metrics
        setSpent(perfMonthlySp);
        setTotalIncome(perfMonthlyInc);
      } else {
        // Global Wallet balance
        setSafeToSpend(cashGlobalInc - cashGlobalSp);
        // Displayed Global Performance Metrics
        setSpent(perfGlobalSp);
        setTotalIncome(perfGlobalInc);
      }
      
      setRecentTransactions(txRes.data || []);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  const isContinuous = currentProject?.type === 'continuous';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Tableau de bord</h1>
              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                isContinuous ? 'bg-green-500/20 text-green-500' : 
                currentProject?.type === 'investment' ? 'bg-purple-500/20 text-purple-500' : 'bg-white/10 text-muted-foreground'
              }`}>
                {isContinuous ? 'Flux Continu' : 
                currentProject?.type === 'investment' ? 'Investissement' : 'Standard'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground uppercase tracking-widest mt-1">Aperçu de vos finances</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Member Filter */}
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <User size={14} />
              </div>
              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-8 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-primary appearance-none transition-all cursor-pointer"
              >
                <option value="all">Tous les membres</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>

            {/* View Toggle */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setViewMode('monthly')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  viewMode === 'monthly' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'
                }`}
              >
                Mensuel
              </button>
              <button 
                onClick={() => setViewMode('global')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  viewMode === 'global' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'
                }`}
              >
                Global
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className={`col-span-12 ${isContinuous ? 'md:col-span-12' : 'md:col-span-8'} glass-card bg-linear-to-br from-muted to-background relative overflow-hidden group min-h-[220px] flex flex-col justify-center`}>
          <div className="relative z-10 p-6 md:p-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {viewMode === 'monthly' ? 'Reste à Vivre' : 'Somme Trésorerie'}
              </span>
              {viewMode === 'monthly' && isContinuous && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 rounded-md">
                  <Layers size={10} className="text-green-500" />
                  <span className="text-[10px] font-bold text-green-500">Flux continu</span>
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-5xl md:text-7xl font-black tracking-tighter ${safeToSpend >= 0 ? 'text-white' : 'text-red-500'}`}>
                {new Intl.NumberFormat('fr-FR').format(safeToSpend)} FCFA
              </span>
            </div>

            {viewMode === 'monthly' && isContinuous && carryOver !== 0 && (
              <div className="mt-3 flex items-center gap-2 text-green-500/70">
                <Info size={14} />
                <p className="text-xs font-medium italic">
                  Inclut {new Intl.NumberFormat('fr-FR').format(carryOver)} FCFA reportés du mois précédent.
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8">
              <div className="grid grid-cols-2 gap-8 flex-1">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Revenus</p>
                  <p className="text-xl font-black text-green-500">+{new Intl.NumberFormat('fr-FR').format(totalIncome)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Dépenses</p>
                  <p className="text-xl font-black text-white">-{new Intl.NumberFormat('fr-FR').format(spent)}</p>
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 min-w-[200px]">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1 italic">Reste du capital</p>
                <p className={`text-xl font-black ${investmentBalance >= 0 ? 'text-blue-400' : 'text-orange-500'}`}>
                  {new Intl.NumberFormat('fr-FR').format(investmentBalance)} FCFA
                </p>
                <p className="text-[8px] text-muted-foreground/60 mt-1 uppercase tracking-tighter">
                  {investmentBalance >= 0 ? 'Argent propre non encore utilisé' : 'Investissement remboursé par les profits'}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full" />
        </div>

        {!isContinuous && (
          <div className="col-span-12 md:col-span-4 grid gap-4">
            <div className="glass-card p-6 flex flex-col justify-center">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Objectif Épargne</span>
              <p className="text-3xl font-black mt-2 text-primary tracking-tighter">{new Intl.NumberFormat('fr-FR').format(savingsGoal)} FCFA</p>
              <p className="text-[10px] text-muted-foreground mt-2 italic leading-tight">Objectif personnel défini dans vos paramètres.</p>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold">Activité Récente</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Rentabilité Réelle : {totalIncome - spent >= 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(totalIncome - spent)} FCFA</p>
          </div>
          <button 
            onClick={props.onViewAll}
            className="text-primary text-xs font-semibold uppercase tracking-widest flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
          >
            Tout voir
          </button>
        </div>
        <div className="space-y-3">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className={`glass-card p-4 flex items-center justify-between ${tx.exclude_from_global ? 'border-dashed border-white/20' : ''}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-muted-foreground'}`}>
                  {tx.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div>
                  <p className="font-semibold text-sm flex items-center gap-2">
                    {tx.description}
                    {tx.exclude_from_global && (
                      <span className="px-1 py-0.5 bg-white/5 text-[7px] text-muted-foreground border border-white/10 rounded">Interne</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-muted-foreground uppercase">{tx.categories?.name || 'Général'}</p>
                    {tx.quantity > 1 && <span className="text-[9px] font-black text-primary px-1 bg-primary/10 rounded">x{tx.quantity}</span>}
                    {tx.town && <span className="text-[9px] text-muted-foreground bg-white/5 px-1 rounded flex items-center gap-1"><Globe size={8} /> {tx.town}</span>}
                    <span className="text-[10px] text-white/20">•</span>
                    <p className="text-[10px] text-primary/70 font-medium">{tx.profiles?.full_name || 'Responsable inconnu'}</p>
                  </div>
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
};

export default Dashboard;

