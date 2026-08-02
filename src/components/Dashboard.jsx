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
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Users,
  Calculator,
  CreditCard,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import CustomerManagement from './CustomerManagement';
import DailyClosingModal from './DailyClosingModal';
import { computeAllProductStocks } from '../lib/stockUtils';
import { computeProjectStats } from '../lib/finance';
import { useRefreshTrigger } from '../hooks/useRefreshTrigger';

const Dashboard = (props) => {
  const { currentProject, members } = useProject();
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'global'
  const [memberFilter, setMemberFilter] = useState('all');
  const [safeToSpend, setSafeToSpend] = useState(0);
  const [spent, setSpent] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [profit, setProfit] = useState(0); // Bénéfice réel : ventes - coût des marchandises vendues - charges
  const [carryOver, setCarryOver] = useState(0);
  const [obligations, setObligations] = useState(0);
  const [savingsGoal, setSavingsGoal] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCustomers, setShowCustomers] = useState(false);
  const [showClosing, setShowClosing] = useState(false);

  // Default to Global view for continuous flow projects
  useEffect(() => {
    if (currentProject?.type === 'continuous') {
      setViewMode('global');
    } else {
      setViewMode('monthly');
    }
  }, [currentProject?.id]);

  const refreshTick = useRefreshTrigger();
  useEffect(() => {
    if (currentProject) {
      fetchData();
    }
  }, [currentProject, viewMode, memberFilter, refreshTick]);

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
      const [obsRes, txRes, txAllRes, profileRes, prodPriceRes] = await Promise.all([
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
          .single(),
        supabase.from('products')
          .select('id, purchase_price')
          .eq('project_id', currentProject.id)
      ]);

      const totalObligations = obsRes.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      setObligations(totalObligations);
      setSavingsGoal(profileRes.data?.monthly_savings_goal || 0);

      const productPriceMap = Object.fromEntries(
        (prodPriceRes.data || []).map(p => [p.id, Number(p.purchase_price || 0)])
      );

      const allTransactions = txAllRes.data || [];

      // Filter base transactions by member if applicable
      const baseFilteredTransactions = memberFilter === 'all'
        ? allTransactions
        : allTransactions.filter(tx => tx.user_id === memberFilter);

      // Tous les chiffres clés viennent de la lib partagée (src/lib/finance.js) :
      // mêmes définitions ici, dans Transactions et dans Statistiques.
      const stats = computeProjectStats(baseFilteredTransactions, {
        allTransactions,
        productPriceMap,
        periodStart: startOfMonth,
        periodEnd: endOfMonth,
      });

      setCarryOver(stats.carryOver);

      if (viewMode === 'monthly') {
        const baseBalance = currentProject.type === 'continuous' ? stats.carryOver : 0;
        // Wallet balance
        setSafeToSpend(baseBalance + stats.cashMonthlyIncome - totalObligations - stats.cashMonthlySpent);
        // Displayed Performance Metrics
        setSpent(stats.perfMonthlySpent);
        setTotalIncome(stats.perfMonthlyIncome);
        setProfit(stats.monthlyProfit);
      } else {
        // Global Wallet balance
        setSafeToSpend(stats.available);
        // Displayed Global Performance Metrics
        setSpent(stats.perfSpent);
        setTotalIncome(stats.perfIncome);
        setProfit(stats.profit);
      }
      
      setRecentTransactions(txRes.data || []);
      
      // --- BUSINESS SPECIFIC DATA ---
      if (currentProject.type === 'continuous') {
        const [stockRes, debtRes] = await Promise.all([
          supabase.from('products')
            .select('id, name, stock_quantity, alert_threshold, purchase_price')
            .eq('project_id', currentProject.id),
          supabase.from('transactions')
            .select('amount')
            .eq('project_id', currentProject.id)
            .eq('payment_status', 'unpaid')
        ]);

        const productsList = stockRes.data || [];
        // Stock dérivé depuis les transactions (source unique de vérité)
        const stockMap = computeAllProductStocks(allTransactions);
        setLowStockProducts(
          productsList
            .map(p => ({ ...p, derivedStock: stockMap[p.id] ?? 0 }))
            .filter(p => p.derivedStock <= Number(p.alert_threshold ?? 5))
        );
        setTotalDebt(debtRes.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0);
      }
      
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
                isContinuous ? 'bg-green-500/20 text-green-500' : 'bg-white/10 text-muted-foreground'
              }`}>
                {isContinuous ? 'Flux Continu' : 'Standard'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground uppercase tracking-widest mt-1">Aperçu de vos finances</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Member Filter */}
              <div className="relative group flex-1 sm:flex-none">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  <User size={14} />
                </div>
                <select
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-8 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-primary appearance-none transition-all cursor-pointer"
                >
                  <option value="all">Tous les membres</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>

              {/* View Toggle */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 flex-1 sm:flex-none">
                <button 
                  onClick={() => setViewMode('monthly')}
                  className={`flex-1 sm:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    viewMode === 'monthly' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-primary-foreground'
                  }`}
                >
                  Mensuel
                </button>
                <button 
                  onClick={() => setViewMode('global')}
                  className={`flex-1 sm:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    viewMode === 'global' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-primary-foreground'
                  }`}
                >
                  Global
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="col-span-12 glass-card bg-linear-to-br from-muted to-background relative overflow-hidden group">
          <div className="relative z-10 p-6 md:p-8">
            {viewMode === 'monthly' && isContinuous && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 rounded-md">
                  <Layers size={10} className="text-green-500" />
                  <span className="text-[10px] font-bold text-green-500">Flux continu</span>
                </div>
                {carryOver !== 0 && (
                  <p className="text-xs font-medium italic text-green-500/70">
                    Inclut {new Intl.NumberFormat('fr-FR').format(carryOver)} FCFA reportés du mois précédent.
                  </p>
                )}
              </div>
            )}

            {/* Chiffres clés : grille uniforme 2×2 (4 colonnes sur desktop),
                l'argent disponible en première position. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  {viewMode === 'monthly' ? 'Reste à Vivre' : 'Argent disponible'}
                </p>
                <p className={`text-xl font-black ${safeToSpend >= 0 ? 'text-white' : 'text-red-500'}`}>
                  {new Intl.NumberFormat('fr-FR').format(safeToSpend)}
                </p>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Revenus</p>
                <p className="text-xl font-black text-green-500">+{new Intl.NumberFormat('fr-FR').format(totalIncome)}</p>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Dépenses</p>
                <p className="text-xl font-black text-white">-{new Intl.NumberFormat('fr-FR').format(spent)}</p>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-1">
                  Bénéfice
                  <span className="group/benef relative">
                    <Info size={11} className="text-primary/60" />
                    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 w-52 opacity-0 group-hover/benef:opacity-100 transition-opacity bg-black/90 border border-white/10 rounded-lg p-2 text-[9px] font-medium normal-case tracking-normal text-white/80 z-20 shadow-xl">
                      Revenus des ventes − coût des marchandises vendues − charges (loyer, salaires, pub…). Les achats de stock ne comptent qu'une fois la marchandise vendue.
                    </span>
                  </span>
                </p>
                <p className={`text-xl font-black ${profit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                  {profit >= 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(Math.round(profit))}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full" />
        </div>

        {/* Objectif d'épargne : uniquement pour les projets personnels. */}
        {!isContinuous && (
          <div className="col-span-12 glass-card p-6 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Objectif Épargne</span>
              {savingsGoal > 0 ? (
                <p className="text-2xl font-black mt-1 text-primary tracking-tighter">{new Intl.NumberFormat('fr-FR').format(savingsGoal)} FCFA</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1 italic">Aucun objectif défini pour le moment.</p>
              )}
            </div>
            <button
              onClick={props.onOpenSettings}
              className="shrink-0 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
            >
              {savingsGoal > 0 ? 'Modifier' : 'Définir un objectif'}
            </button>
          </div>
        )}

        {isContinuous && (
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Low Stock Alert */}
            {lowStockProducts.length > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-[2rem] p-6">
                <div className="flex items-center gap-2 mb-4 text-orange-500">
                  <AlertTriangle size={20} />
                  <h3 className="font-bold uppercase tracking-widest text-xs">Alertes Stock Bas</h3>
                </div>
                <div className="space-y-2">
                  {lowStockProducts.map((p, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-sm font-bold">{p.name}</span>
                      <span className="text-xs font-black text-orange-500">{p.derivedStock} restants</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debt Overview */}
            {totalDebt > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-[2rem] p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4 text-blue-400">
                    <CreditCard size={20} />
                    <h3 className="font-bold uppercase tracking-widest text-xs">L'Ardoise (Dettes)</h3>
                  </div>
                  <p className="text-4xl font-black text-blue-400 tracking-tighter">
                    {new Intl.NumberFormat('fr-FR').format(totalDebt)} FCFA
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest">Montant total à recouvrir auprès des clients.</p>
                </div>
                <button 
                  onClick={() => setShowCustomers(true)}
                  className="mt-6 w-full py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                >
                  Gérer les clients
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {showCustomers && (
        <div className="fixed inset-0 z-[250] bg-muted overflow-y-auto p-6 animate-in slide-in-from-right duration-300">
          <div className="max-w-4xl mx-auto">
            <button 
              onClick={() => { setShowCustomers(false); fetchData(); }}
              className="mb-8 flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
            >
              <X size={20} /> Retour au Dashboard
            </button>
            <CustomerManagement />
          </div>
        </div>
      )}


      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold">Activité Récente</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Bénéfice : {profit >= 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(Math.round(profit))} FCFA</p>
          </div>
          <button
            onClick={props.onViewAll}
            className="text-primary text-xs font-semibold uppercase tracking-widest flex items-center gap-1 cursor-pointer hover:opacity-80 hover:translate-x-0.5 transition-all"
          >
            Toutes les transactions <ChevronRight size={14} />
          </button>
        </div>
        <div className="space-y-3">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className={`glass-card p-4 flex items-center justify-between group hover:border-white/10 transition-all ${tx.exclude_from_global ? 'opacity-60 border-dashed bg-white/5' : ''}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${tx.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-muted-foreground'}`}>
                  {tx.type === 'income' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-bold text-sm ${tx.exclude_from_global ? 'line-through text-muted-foreground' : ''}`}>{tx.description}</p>
                    {tx.exclude_from_global && (
                      <span className="text-[7px] font-black bg-primary text-primary-foreground px-1 py-0.5 rounded uppercase">Interne</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter bg-white/5 px-2 py-0.5 rounded">
                      {tx.categories?.name || 'Général'}
                    </span>
                    {tx.quantity > 1 && (
                      <span className="text-[10px] text-primary font-black bg-primary/10 px-2 py-0.5 rounded">
                        x{tx.quantity}
                      </span>
                    )}
                    {tx.town && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                        <Globe size={10} />
                        {tx.town}
                      </span>
                    )}
                    <span className="text-[10px] text-white/20">•</span>
                    <span className="text-[10px] text-primary/70 font-medium">
                      {tx.profiles?.full_name || 'Inconnu'}
                    </span>
                  </div>
                </div>
              </div>
              <span className={`font-black text-base ${tx.exclude_from_global ? 'text-muted-foreground opacity-50' : (tx.type === 'income' ? 'text-green-500' : 'text-white')}`}>
                {tx.type === 'income' ? '+' : '-'}{new Intl.NumberFormat('fr-FR').format(tx.amount)}
              </span>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <button
              onClick={props.onAddTransaction}
              className="w-full glass-card border-dashed border-primary/30 py-10 flex flex-col items-center gap-3 hover:border-primary/60 active:scale-[0.99] transition-all cursor-pointer"
            >
              <span className="text-4xl animate-bounce">👇</span>
              <div className="text-center space-y-1">
                <p className="font-black text-base">Note ta première opération</p>
                <p className="text-sm text-muted-foreground px-8 leading-snug">
                  Une vente, une dépense… Appuie ici (ou sur le bouton bleu <span className="font-black text-primary">+</span>) pour commencer.
                </p>
              </div>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;

