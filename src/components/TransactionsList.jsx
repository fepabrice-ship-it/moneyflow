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
  User,
  Globe,
  CheckCircle2,
  CheckSquare,
  Square,
  Check,
  X
} from 'lucide-react';

import { useProject } from '../contexts/ProjectContext';
import BulkEditModal from './BulkEditModal';

const TransactionsList = ({ onEdit }) => {
  const { currentProject, members } = useProject();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'all'
  
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

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
  }, [selectedMonth, selectedYear, typeFilter, categoryFilter, memberFilter, currentProject, viewMode]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('transactions')
        .select('*, categories(name, type), profiles(full_name)')
        .eq('project_id', currentProject.id)
        .order('date', { ascending: false });

      if (viewMode === 'monthly') {
        const startOfMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        const endOfMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('date', startOfMonth).lte('date', endOfMonth);
      }

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
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Effacer les ${selectedIds.length} opérations sélectionnées ?`)) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('transactions').delete().in('id', selectedIds);
      if (error) throw error;
      
      setTransactions(transactions.filter(t => !selectedIds.includes(t.id)));
      setSelectedIds([]);
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTransactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTransactions.map(tx => tx.id));
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
    if (viewMode !== 'monthly') setViewMode('monthly');
  };

  const filteredTransactions = transactions.filter(tx => 
    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.categories?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  let totalIncome = 0;
  let totalExpense = 0;
  
  filteredTransactions.forEach(tx => {
    if (tx.exclude_from_global) return; // Skip technical/carry-over transactions in totals
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

        <div className="flex items-center gap-2">
           {/* View Toggle */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 h-fit">
            <button 
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                viewMode === 'monthly' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'
              }`}
            >
              Mensuel
            </button>
            <button 
              onClick={() => setViewMode('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                viewMode === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'
              }`}
            >
              Global
            </button>
          </div>

          {/* Month Selector */}
          <div className={`flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/5 transition-opacity ${viewMode === 'all' ? 'opacity-50 grayscale pointer-events-none' : 'opacity-100'}`}>
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center min-w-[100px]">
              <p className="text-xs font-bold capitalize">{monthName}</p>
              <p className="text-[9px] text-muted-foreground">{selectedYear}</p>
            </div>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic Summary/Total Card */}
      <div className="glass-card bg-primary/5 border-primary/20 p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              {viewMode === 'monthly' ? 'Bilan mensuel' : 'Bilan Global'}
            </p>
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

        <div className="pt-4 border-t border-white/5 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
              {filteredTransactions.length} Opérations trouvées
            </span>
            {filteredTransactions.some(tx => tx.exclude_from_global) && (
              <span className="text-[10px] font-bold uppercase text-primary tracking-widest">
                • Exclusions techniques
              </span>
            )}
          </div>
          
          <button 
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors"
          >
            {selectedIds.length === filteredTransactions.length && filteredTransactions.length > 0 ? (
              <><CheckSquare size={14} /> Tout désélectionner</>
            ) : (
              <><Square size={14} /> Tout sélectionner</>
            )}
          </button>
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
            <div key={tx.id} className={`glass-card p-4 flex items-center justify-between group hover:border-white/10 transition-all ${
              selectedIds.includes(tx.id) ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : ''
            } ${tx.exclude_from_global ? 'opacity-60 border-dashed bg-white/5' : ''}`}>
              <div className="flex items-center gap-4">
                {/* Checkbox Trigger */}
                <button 
                  onClick={() => toggleSelection(tx.id)}
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                    selectedIds.includes(tx.id) ? 'bg-primary border-primary' : 'bg-white/5 border-white/10 hover:border-primary/50'
                  }`}
                >
                  {selectedIds.includes(tx.id) && <Check size={14} className="text-white" />}
                </button>

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                  tx.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-muted-foreground'
                }`}>
                  {tx.type === 'income' ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-bold text-base ${tx.exclude_from_global ? 'line-through text-muted-foreground' : ''}`}>{tx.description}</p>
                    {tx.exclude_from_global && (
                      <span className="text-[7px] font-black bg-primary text-white px-1 py-0.5 rounded uppercase">Interne</span>
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
                <span className={`font-black text-lg ${tx.exclude_from_global ? 'text-muted-foreground opacity-50' : (tx.type === 'income' ? 'text-green-500' : 'text-white')}`}>
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

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] w-[calc(100%-3rem)] max-w-lg bg-black/80 backdrop-blur-2xl border border-primary/30 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-black text-xs">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white leading-none">Sélectionnés</p>
              <p className="text-[8px] text-muted-foreground mt-1 uppercase tracking-widest">Options groupées</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <button 
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2"
            >
              <Pencil size={14} /> Modifier
            </button>
            <button 
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center gap-2"
            >
              <Trash2 size={14} /> Supprimer
            </button>
            <button 
              onClick={() => setSelectedIds([])}
              className="p-2 text-muted-foreground hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      <BulkEditModal 
        isOpen={showBulkModal}
        onClose={() => {
          setShowBulkModal(false);
          setSelectedIds([]);
        }}
        selectedIds={selectedIds}
        onRefresh={() => {
          fetchTransactions();
          window.dispatchEvent(new CustomEvent('refresh-data'));
        }}
      />
    </div>
  );
};

export default TransactionsList;
