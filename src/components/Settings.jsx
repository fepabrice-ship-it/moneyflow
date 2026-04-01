import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Loader2, Target, User, Shield, LogOut } from 'lucide-react';

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [profile, setProfile] = useState({
    monthly_savings_goal: 0,
    full_name: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setFetching(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'not found'
      
      if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...profile,
          updated_at: new Date()
        });

      if (error) throw error;
      alert('Paramètres enregistrés !');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-[10px] mt-1">Personnalisez votre MoneyFlow</p>
      </header>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Savings Goal Section */}
        <div className="glass-card space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Target size={20} />
            <h2 className="font-bold">Objectifs Financiers</h2>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Objectif Épargne Mensuel (FCFA)</label>
            <div className="relative">
              <input
                type="number"
                value={profile.monthly_savings_goal}
                onChange={(e) => setProfile({ ...profile, monthly_savings_goal: parseFloat(e.target.value) || 0 })}
                className="w-full bg-background border border-white/5 rounded-2xl py-4 px-6 text-xl font-black focus:border-primary outline-none transition-all"
                placeholder="Ex: 75000"
              />
            </div>
            <p className="text-[10px] text-muted-foreground italic ml-1">C'est le montant que vous souhaitez mettre de côté chaque mois pour vos projets ou tontines.</p>
          </div>
        </div>

        {/* User Info Section */}
        <div className="glass-card space-y-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <User size={20} />
            <h2 className="font-bold">Informations Personnelles</h2>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nom Complet</label>
            <input
              type="text"
              value={profile.full_name || ''}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              className="w-full bg-background border border-white/5 rounded-xl py-3 px-4 focus:border-primary outline-none transition-all"
              placeholder="Ex: Brayce Master"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black h-14 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-white/5 cursor-pointer"
        >
          {loading ? <Loader2 className="animate-spin" size={24} /> : (
            <>
              <Save size={20} />
              Enregistrer les modifications
            </>
          )}
        </button>

        <button
          type="button"
          onClick={async () => {
            if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
              await supabase.auth.signOut();
            }
          }}
          className="w-full bg-red-500/10 text-red-500 h-14 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer border border-red-500/20"
        >
          <LogOut size={20} />
          Se déconnecter (Changer de compte)
        </button>
      </form>
    </div>
  );
};

export default Settings;
