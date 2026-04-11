import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Target, 
  Shield, 
  User, 
  Save, 
  Loader2, 
  LogOut 
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

const Settings = () => {
  const { currentProject, createProject, renameProject, refreshProjects } = useProject();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renameProjectName, setRenameProjectName] = useState(currentProject?.name || '');
  const [isRenaming, setIsRenaming] = useState(false);
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

      if (error && error.code !== 'PGRST116') throw error;
      
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

  const handleRename = async (e) => {
    e.preventDefault();
    if (!renameProjectName || !currentProject) return;
    setIsRenaming(true);
    try {
      await renameProject(currentProject.id, renameProjectName);
      alert('Projet renommé !');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !currentProject) return;
    setInviting(true);
    try {
      const { data: userData, error: userError } = await supabase
        .rpc('get_user_id_by_email', { email_input: inviteEmail });

      if (userError) throw new Error('Utilisateur non trouvé ou erreur de recherche');
      if (!userData) throw new Error('Utilisateur non trouvé');

      const { error: inviteError } = await supabase
        .from('project_members')
        .insert([{
          project_id: currentProject.id,
          user_id: userData,
          role: 'member'
        }]);

      if (inviteError) throw inviteError;
      alert('Utilisateur invité avec succès !');
      setInviteEmail('');
      refreshProjects();
    } catch (err) {
      alert(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName) return;
    try {
      await createProject(newProjectName);
      setNewProjectName('');
      alert('Projet créé !');
    } catch (err) {
      alert(err.message);
    }
  };

  if (fetching) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-[10px] mt-1">Personnalisez votre MoneyFlow</p>
      </header>

      {/* Project Management Section */}
      <div className="glass-card space-y-6">
        <div className="flex items-center gap-3 text-primary">
          <Shield size={20} />
          <h2 className="font-bold">Gestion du Projet Actif</h2>
        </div>

        {/* Rename Project (Only for owner) */}
        {currentProject?.role === 'owner' && (
          <form onSubmit={handleRename} className="space-y-2 border-b border-white/5 pb-6">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Renommer le projet actuel</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={renameProjectName}
                onChange={(e) => setRenameProjectName(e.target.value)}
                className="flex-1 bg-background border border-white/5 rounded-xl py-3 px-4 focus:border-primary outline-none transition-all text-sm font-bold"
                placeholder="Nouveau nom du projet"
              />
              <button
                type="submit"
                disabled={isRenaming}
                className="bg-primary text-white px-6 rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isRenaming ? <Loader2 className="animate-spin" size={18} /> : 'Mettre à jour'}
              </button>
            </div>
          </form>
        )}

        {/* Invite Member (Only for owner) */}
        {currentProject?.role === 'owner' && (
          <form onSubmit={handleInvite} className="space-y-2 border-b border-white/5 pb-6">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Inviter un membre par email</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 bg-background border border-white/5 rounded-xl py-3 px-4 focus:border-primary outline-none transition-all text-sm"
                placeholder="email@exemple.com"
              />
              <button
                type="submit"
                disabled={inviting}
                className="bg-primary text-white px-6 rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
              >
                {inviting ? <Loader2 className="animate-spin" size={18} /> : 'Inviter'}
              </button>
            </div>
          </form>
        )}

        {/* Create New Project */}
        <form onSubmit={handleCreateProject} className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Créer un nouveau projet</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="flex-1 bg-background border border-white/5 rounded-xl py-3 px-4 focus:border-primary outline-none transition-all text-sm"
              placeholder="Nom du projet (ex: Business)"
            />
            <button
              type="submit"
              className="bg-white text-black px-6 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all cursor-pointer"
            >
              Créer
            </button>
          </div>
        </form>
      </div>

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
