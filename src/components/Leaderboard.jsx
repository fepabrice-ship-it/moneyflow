import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, User, DollarSign, Loader2, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';

const Leaderboard = () => {
  const { currentProject, members } = useProject();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const isOwner = currentProject?.role === 'owner';

  useEffect(() => {
    if (currentProject && isOwner) {
      fetchStats();
    }
  }, [currentProject, isOwner]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Fetch all income transactions for this project
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, user_id')
        .eq('project_id', currentProject.id)
        .eq('type', 'income')
        .eq('payment_status', 'paid'); // Only count real revenue for performance

      if (error) throw error;

      // Aggregate by user
      const userRevenue = {};
      data.forEach(tx => {
        userRevenue[tx.user_id] = (userRevenue[tx.user_id] || 0) + Number(tx.amount);
      });

      // Map to member names
      const leaderboardData = members.map(m => ({
        id: m.id,
        name: m.full_name,
        revenue: userRevenue[m.id] || 0,
        avatar: m.avatar_url
      })).sort((a, b) => b.revenue - a.revenue);

      setStats(leaderboardData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) return (
    <div className="glass-card p-8 text-center flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
        <Crown size={32} />
      </div>
      <div>
        <h3 className="text-lg font-bold">Accès Restreint</h3>
        <p className="text-sm text-muted-foreground">Seul le propriétaire du projet peut consulter les performances des membres.</p>
      </div>
    </div>
  );

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="glass-card p-6 space-y-6">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 text-yellow-500 rounded-lg">
            <Trophy size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Classement Performance</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Revenus générés par membre</p>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {stats.map((member, index) => (
          <div key={member.id} className="relative flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-primary/20 transition-all">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                {index === 0 && <Crown size={14} className="absolute -top-1 -right-1 text-yellow-500" />}
              </div>
              <div>
                <p className="font-bold text-sm">{member.name}</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <TrendingUp size={10} className="text-green-500" />
                  <span>Productivité active</span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-black text-white">
                {new Intl.NumberFormat('fr-FR').format(member.revenue)} FCFA
              </p>
              <div className="w-24 h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full ${index === 0 ? 'bg-yellow-500' : 'bg-primary'}`} 
                  style={{ width: `${stats[0].revenue > 0 ? (member.revenue / stats[0].revenue) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Rank Badge */}
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-background border border-white/10 flex items-center justify-center text-[10px] font-black text-muted-foreground group-hover:border-primary transition-colors">
              {index + 1}
            </div>
          </div>
        ))}
      </div>

      {stats.length === 0 && (
        <div className="text-center py-10 text-muted-foreground italic">Aucune donnée de revenu disponible.</div>
      )}
    </div>
  );
};

export default Leaderboard;
