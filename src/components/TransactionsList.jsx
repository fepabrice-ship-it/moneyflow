import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Trash2, 
  Pencil,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Tag,
  User
} from 'lucide-react';

import { useProject } from '../contexts/ProjectContext';

const TransactionsList = ({ onEdit }) => {
  const { currentProject, members } = useProject();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (currentProject) {
      fetchTransactions();
    }
    
    const handleRefresh = () => fetchTransactions();
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [selectedMonth, selectedYear, typeFilter, categoryFilter, memberFilter, currentProject]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      const startOfMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endOfMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let query = supabase
        .from('transactions')
        .select('*, categories(name, type), profiles(full_name)')
        .eq('project_id', currentProject.id)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
        .order('date', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category_id', categoryFilter);
      }

      if (memberFilter !== 'all') {
        query = query.eq('user_id', memberFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Effacer cette opération ?')) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      setTransactions(transactions.filter(t => t.id !== id));
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (err) {
      alert(err.message);
    }
  };

  const changeMonth = (delta) => {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const filteredTransactions = transactions.filter(tx => 
    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.categories?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  let totalIncome = 0;
  let totalExpense = 0;
  
  filteredTransactions.forEach(tx => {
    if (tx.type === 'income') totalIncome += Number(tx.amount);
    else totalExpense += Number(tx.amount);
  });

  const totalFiltered = totalIncome - totalExpense;

  const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(selectedYear, selectedMonth - 1));

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Transactions</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-[10px] mt-1">Historique de vos opérations</p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center min-w-[120px]">
            <p className="text-sm font-bold capitalize">{monthName}</p>
            <p className="text-[10px] text-muted-foreground">{selectedYear}</p>
          </div>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Dynamic Summary/Total Card */}
      <div className="glass-card bg-primary/5 border-primary/20 p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Bilan sélection</p>
            <p className={`text-4xl font-black mt-1 ${totalFiltered >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalFiltered > 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(totalFiltered)} FCFA
            </p>
          </div>
          
          <div className="flex gap-8 w-full md:w-auto">
            <div className="flex-1 md:flex-none">
              <p className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Total Revenus
              </p>
              <p className="text-xl font-bold mt-1 text-green-500">
                {new Intl.NumberFormat('fr-FR').format(totalIncome)} FCFA
              </p>
            </div>
            <div className="flex-1 md:flex-none">
              <p className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Total Dépenses
              </p>
              <p className="text-xl font-bold mt-1 text-white/90">
                {new Intl.NumberFormat('fr-FR').format(totalExpense)} FCFA
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 flex gap-4 text-center">
          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
            {filteredTransactions.length} Opérations trouvées
          </span>
        </div>
      </div>

      {/* Filters & Search - NO LONGER STICKY */}
      <div className="bg-transparent space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Rechercher une opération..."
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-primary transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            {['all', 'expense', 'income'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border ${
                  typeFilter === type 
                  ? 'bg-white text-black border-white' 
                  : 'bg-white/5 text-muted-foreground border-white/5 hover:border-white/10'
                }`}
              >
                {type === 'all' ? 'Touts' : type === 'expense' ? 'Dépenses' : 'Revenus'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Category Select */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none">
              <Tag size={14} />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl py-3 pl-10 pr-10 text-xs font-bold uppercase tracking-wider outline-none focus:border-primary appearance-none transition-all text-white"
            >
              <option value="all" className="bg-[#1a1a1a]">Toutes les catégories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-[#1a1a1a]">{cat.name}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none">
              <ChevronDown size={18} strokeWidth={3} />
            </div>
          </div>

          {/* Member Select */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none">
              <User size={14} />
            </div>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl py-3 pl-10 pr-10 text-xs font-bold uppercase tracking-wider outline-none focus:border-primary appearance-none transition-all text-white"
            >
              <option value="all" className="bg-[#1a1a1a]">Tous les membres</option>
              {members.map(m => (
                <option key={m.id} value={m.id} className="bg-[#1a1a1a]">{m.full_name}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none">
              <ChevronDown size={18} strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
        ) : filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => (
            <div key={tx.id} className="glass-card p-4 flex items-center justify-between group hover:border-white/10 transition-all">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                  tx.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-muted-foreground'
                }`}>
                  {tx.type === 'income' ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
                </div>
                <div>
                  <p className="font-bold text-base">{tx.description}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter bg-white/5 px-2 py-0.5 rounded">
                      {tx.categories?.name || 'Général'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(tx.date))}
                    </span>
                    <span className="text-[10px] text-white/20">•</span>
                    <span className="text-[10px] text-primary/70 font-medium">
                      {tx.profiles?.full_name || 'Responsable inconnu'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-4">
                <span className={`font-black text-lg ${tx.type === 'income' ? 'text-green-500' : 'text-white'}`}>
                  {tx.type === 'income' ? '+' : '-'}{new Intl.NumberFormat('fr-FR').format(tx.amount)} FCFA
                </span>
                
                <div className="flex items-center gap-1 transition-all">
                  <button 
                    onClick={() => onEdit(tx)}
                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all cursor-pointer"
                  >
                    <Pencil size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(tx.id)}
                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-card py-20 text-center flex flex-col items-center gap-4 bg-muted/20">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground">
              <Calendar size={32} />
            </div>
            <div>
              <p className="font-bold">Aucune transaction</p>
              <p className="text-xs text-muted-foreground px-10">Essayez de changer les filtres ou de créer une nouvelle opération.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsList;
