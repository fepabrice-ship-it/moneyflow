import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  LayoutDashboard, 
  Receipt, 
  Settings,
  MoreVertical,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';
import { supabase } from './lib/supabase';

const COLORS = ['#3b82f6', '#171717', '#ef4444'];
const CURRENCY = 'FCFA';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' ' + CURRENCY;
};

const Card = ({ title, amount, subtitle, type = 'default' }) => (
  <div className="glass-card flex flex-col gap-2">
    <div className="flex justify-between items-start">
      <span className="text-muted-foreground text-sm font-medium">{title}</span>
      <MoreVertical size={16} className="text-muted-foreground cursor-pointer" />
    </div>
    <div className="flex flex-col gap-1">
      <span className={`text-2xl font-semibold ${type === 'primary' ? 'text-primary' : type === 'danger' ? 'text-red-500' : ''}`}>
        {formatCurrency(amount)}
      </span>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  </div>
);

const App = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [safeToSpend, setSafeToSpend] = useState(0);
  const [spent, setSpent] = useState(0);
  const [obligations, setObligations] = useState(0);
  const [toSave, setToSave] = useState(0);
  const [toSpend, setToSpend] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Mocking data for now as DB might not be seeded yet
      // In a real scenario, we would use: 
      // const { data } = await supabase.from('transactions').select('*')...
      
      setTimeout(() => {
        setSafeToSpend(450000);
        setSpent(120000);
        setObligations(250000);
        setToSave(75000);
        setToSpend(180000);
        setRecentTransactions([
          { label: 'Gym Membership', category: 'Obligations', amount: -25000, date: 'Today' },
          { label: 'Starbucks', category: 'Loisirs', amount: -4500, date: 'Yesterday' },
          { label: 'Salary Deposit', category: 'Income', amount: 850000, date: 'Feb 25' },
        ]);
        setLoading(false);
      }, 800);
    } catch (err) {
      console.error(err);
      setError("Failed to sync with Supabase. Please check your credentials.");
      setLoading(false);
    }
  };

  const CHART_DATA = [
    { name: 'Obligations', value: obligations, color: '#3b82f6' },
    { name: 'Spent (Loisirs)', value: spent, color: '#ef4444' },
    { name: 'Remaining', value: safeToSpend, color: '#171717' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Header */}
      <header className="p-6 md:p-10 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold tracking-tight">MoneyFlow</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Brayce Edition</p>
        </div>
        <div className="flex items-center gap-4">
          {error && <AlertCircle className="text-red-500" size={20} title={error} />}
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold">B</span>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-10 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Safe to Spend Indicator */}
        <section className="col-span-12 md:col-span-8 space-y-6">
          <div className="glass-card bg-gradient-to-br from-[#171717] to-[#0a0a0a] border-white/10 relative overflow-hidden group min-h-[220px] flex flex-col justify-center">
            <div className="relative z-10">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Reste à Vivre</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-5xl md:text-6xl font-black tracking-tighter text-white">
                  {formatCurrency(safeToSpend)}
                </span>
              </div>
              <p className="mt-4 text-xs text-muted-foreground max-w-sm leading-relaxed">
                Your liquid budget after deducting all monthly obligations ({formatCurrency(obligations)}) and current spending.
              </p>
            </div>
            
            {/* Visual background accent */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full group-hover:bg-primary/20 transition-colors" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card 
              title="Restant à Dépenser (Loisirs)" 
              amount={toSpend - spent} 
              subtitle={`Budget Initial: ${formatCurrency(toSpend)}`} 
              type={(toSpend - spent) < (toSpend * 0.2) ? 'danger' : 'default'}
            />
            <Card 
              title="Objectif Épargne" 
              amount={toSave} 
              subtitle="Tontines et épargne automatique" 
              type="primary"
            />
          </div>
        </section>

        {/* Breakdown Circle */}
        <aside className="col-span-12 md:col-span-4 flex flex-col gap-6">
          <div className="glass-card flex flex-col items-center justify-center min-h-[300px]">
            <span className="text-sm font-medium text-muted-foreground mb-4 w-full text-left uppercase tracking-tighter">Répartition Mensuelle</span>
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={CHART_DATA}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {CHART_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#171717', 
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)', 
                      color: '#fff',
                      fontSize: '12px'
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-4 w-full">
              {CHART_DATA.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] text-muted-foreground uppercase">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="w-full bg-primary text-white h-14 rounded-2xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-lg shadow-primary/20">
            <Plus size={20} />
            Noter une Dépense
          </button>
        </aside>

        {/* Recent Transactions */}
        <section className="col-span-12 mt-4 mb-20 md:mb-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold tracking-tight">Activité Récente</h2>
            <button className="text-primary text-xs font-semibold uppercase tracking-widest flex items-center gap-1">
              Tout voir <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentTransactions.map((tx, i) => (
              <div key={i} className="glass-card p-4 flex items-center justify-between hover:border-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-muted-foreground'}`}>
                    {tx.amount > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{tx.label}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{tx.category} • {tx.date}</p>
                  </div>
                </div>
                <span className={`font-bold ${tx.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-6 left-6 right-6 h-16 bg-[#171717]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-2 flex items-center justify-around md:hidden z-50 shadow-2xl">
        <button className="p-2 text-primary bg-primary/10 rounded-xl">
          <LayoutDashboard size={24} />
        </button>
        <button className="p-2 text-muted-foreground hover:text-white transition-colors">
          <Receipt size={24} />
        </button>
        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center -mt-10 shadow-lg shadow-primary/30 border-4 border-background">
          <Plus size={24} className="text-white" />
        </div>
        <button className="p-2 text-muted-foreground hover:text-white transition-colors">
          <Wallet size={24} />
        </button>
        <button className="p-2 text-muted-foreground hover:text-white transition-colors">
          <Settings size={24} />
        </button>
      </nav>
    </div>
  );
};

export default App;
