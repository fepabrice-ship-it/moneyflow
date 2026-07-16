import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, TrendingUp, Loader2, Crown, ShoppingBag, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { useRefreshTrigger } from '../hooks/useRefreshTrigger';

// Catégories exclues des stats publiques par membre :
// - "Salaire" est considéré personnel ; chacun voit son salaire sur son dashboard
//   filtré sur lui-même, mais on ne l'expose pas aux autres collègues.
// - "Capital" et toute transaction marquée "exclude_from_global" sont des flux
//   internes (apports, transferts) et ne reflètent ni performance ni perte.
const EXCLUDED_CAT_NAMES = new Set(['Salaire', 'Capital']);

const Leaderboard = () => {
  const { currentProject, members } = useProject();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('net'); // 'net' | 'revenue' | 'pieces'

  const refreshTick = useRefreshTrigger();
  useEffect(() => {
    if (currentProject) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, refreshTick]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, user_id, type, quantity, exclude_from_global, payment_status, categories(name)')
        .eq('project_id', currentProject.id);
      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const byUser = {};
    transactions.forEach(tx => {
      const catName = tx.categories?.name;
      if (tx.exclude_from_global || EXCLUDED_CAT_NAMES.has(catName)) return;
      const uid = tx.user_id;
      if (!uid) return;
      if (!byUser[uid]) byUser[uid] = { revenue: 0, expense: 0, pieces: 0, sales: 0 };
      const amt = Number(tx.amount || 0);
      if (tx.type === 'income') {
        // On compte les revenus encaissés ; les ventes à crédit non payées
        // ne comptent pas dans la performance "argent rentré".
        if (tx.payment_status !== 'unpaid') byUser[uid].revenue += amt;
        if (catName === 'Vente') {
          byUser[uid].pieces += Number(tx.quantity || 0);
          byUser[uid].sales += 1;
        }
      } else {
        byUser[uid].expense += amt;
      }
    });

    const rows = members.map(m => {
      const s = byUser[m.id] || { revenue: 0, expense: 0, pieces: 0, sales: 0 };
      return {
        id: m.id,
        name: m.full_name,
        revenue: s.revenue,
        expense: s.expense,
        net: s.revenue - s.expense,
        pieces: s.pieces,
        sales: s.sales,
      };
    });

    rows.sort((a, b) => b[sortBy] - a[sortBy]);
    return rows;
  }, [transactions, members, sortBy]);

  if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  const top = stats[0]?.[sortBy] || 0;
  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);

  // Métadonnées d'affichage par tri : libellé + suffixe à droite de la carte
  const HEADLINE = {
    net:     { label: 'Net',     suffix: ' F' },
    revenue: { label: 'Revenus', suffix: ' F' },
    pieces:  { label: 'Pièces',  suffix: '' },
  };
  const headline = HEADLINE[sortBy];

  return (
    <div className="glass-card p-6 space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 text-yellow-500 rounded-lg">
            <Trophy size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Classement Performance</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Comparatif transparent par membre</p>
          </div>
        </div>

        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 self-start sm:self-auto">
          {[
            { id: 'net', label: 'Net' },
            { id: 'revenue', label: 'Revenus' },
            { id: 'pieces', label: 'Pièces' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                sortBy === opt.id ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-3">
        {stats.map((m, idx) => {
          const value = m[sortBy];
          const ratio = top > 0 ? Math.max(0, (value / top) * 100) : 0;
          const isNegative = value < 0;
          return (
            <div key={m.id} className="relative p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-primary/20 transition-all">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm">
                      {m.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    {idx === 0 && top > 0 && <Crown size={14} className="absolute -top-1 -right-1 text-yellow-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <ShoppingBag size={10} className="text-primary" /> {m.sales} ventes • {fmt(m.pieces)} pcs
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black ${isNegative ? 'text-red-500' : 'text-white'}`}>{fmt(value)}{headline.suffix}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-tighter">{headline.label}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                  <ArrowDownLeft size={12} className="text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[8px] uppercase tracking-widest text-muted-foreground">Revenus</p>
                    <p className="text-xs font-black text-green-500 truncate">{fmt(m.revenue)} F</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                  <ArrowUpRight size={12} className="text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[8px] uppercase tracking-widest text-muted-foreground">Dépenses</p>
                    <p className="text-xs font-black text-orange-500 truncate">{fmt(m.expense)} F</p>
                  </div>
                </div>
              </div>

              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${idx === 0 && top > 0 ? 'bg-yellow-500' : isNegative ? 'bg-red-500' : 'bg-primary'}`}
                  style={{ width: `${ratio}%` }}
                />
              </div>

              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-background border border-white/10 flex items-center justify-center text-[10px] font-black text-muted-foreground group-hover:border-primary transition-colors">
                {idx + 1}
              </div>
            </div>
          );
        })}

        {stats.length === 0 && (
          <div className="text-center py-10 text-muted-foreground italic">Aucun membre dans ce projet.</div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
