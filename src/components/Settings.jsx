import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Target, 
  Shield, 
  User, 
  Save, 
  Loader2, 
  LogOut,
  ChevronRight,
  Info
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

const PROJECT_TYPES = [
  { 
    id: 'standard', 
    name: 'Standard', 
    desc: 'Indépendant chaque mois (Usage personnel).',
    color: 'bg-blue-500'
  },
  { 
    id: 'continuous', 
    name: 'Flux Continu', 
    desc: 'Le solde restant est reporté au mois suivant (Projet/Business).',
    color: 'bg-green-500'
  },
  { 
    id: 'investment', 
    name: 'Investissement', 
    desc: 'Distingue Capital initial et Revenus d\'exploitation.',
    color: 'bg-purple-500'
  }
];

const Settings = () => {
  const { currentProject, createProject, updateProject, refreshProjects } = useProject();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState('standard');
  
  const [renameProjectName, setRenameProjectName] = useState(currentProject?.name || '');
  const [renameProjectType, setRenameProjectType] = useState(currentProject?.type || 'standard');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [profile, setProfile] = useState({
    monthly_savings_goal: 0,
    full_name: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (currentProject) {
      setRenameProjectName(currentProject.name);
      setRenameProjectType(currentProject.type || 'standard');
    }
  }, [currentProject]);

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

  const handleUpdateCurrentProject = async (e) => {
    e.preventDefault();
    if (!renameProjectName || !currentProject) return;
    setIsUpdating(true);
    try {
      await updateProject(currentProject.id, { 
        name: renameProjectName, 
        type: renameProjectType 
      });
      alert('Projet mis à jour !');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
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
      await createProject(newProjectName, newProjectType);
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

      {/* Current Project Config Card */}
      <div className="glass-card space-y-6">
        <div className="flex items-center gap-3 text-primary">
          <Shield size={20} />
          <h2 className="font-bold">Configuration du Projet Actif</h2>
        </div>

        {currentProject?.role === 'owner' ? (
          <form onSubmit={handleUpdateCurrentProject} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nom du projet</label>
              <input
                type="text"
                value={renameProjectName}
                onChange={(e) => setRenameProjectName(e.target.value)}
                className="w-full bg-background border border-white/5 rounded-xl py-3 px-4 focus:border-primary outline-none transition-all text-sm font-bold"
                placeholder="Ex: Mon Business"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Type de Logique</label>
              <div className="grid grid-cols-1 gap-2">
                {PROJECT_TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setRenameProjectType(t.id)}
                    className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left ${
                      renameProjectType === t.id 
                      ? 'bg-primary/10 border-primary shadow-lg' 
                      : 'bg-background border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${renameProjectType === t.id ? 'bg-primary animate-pulse' : 'bg-white/20'}`} />
                    <div>
                      <p className="font-bold text-sm">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdating}
              className="w-full bg-primary text-white h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="animate-spin" size={18} /> : 'Mettre à jour le projet'}
            </button>
          </form>
        ) : (
          <div className="p-4 bg-white/5 rounded-xl flex items-center gap-3">
            <Info size={18} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Seul le propriétaire peut modifier le type du projet.</p>
          </div>
        )}

        {/* Invite Member */}
        {currentProject?.role === 'owner' && (
          <form onSubmit={handleInvite} className="space-y-2 pt-6 border-t border-white/5">
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
      </div>

      {/* Create New Project Section */}
      <div className="glass-card space-y-6 border-primary/20 bg-primary/5">
        <h2 className="font-bold flex items-center gap-2">
          Nouveau Projet
          <span className="text-[8px] bg-primary text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Premium</span>
        </h2>

        <form onSubmit={handleCreateProject} className="space-y-6">
          <div className="space-y-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full bg-background border border-white/5 rounded-xl py-3 px-4 focus:border-primary outline-none transition-all text-sm"
              placeholder="Nom du projet..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {PROJECT_TYPES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setNewProjectType(t.id)}
                className={`flex flex-col gap-2 p-3 rounded-xl border text-center transition-all ${
                  newProjectType === t.id 
                  ? 'bg-white text-black border-white' 
                  : 'bg-white/5 text-muted-foreground border-white/5 hover:border-white/10'
                }`}
              >
                <p className="font-black text-[10px] uppercase tracking-widest">{t.name}</p>
                <p className="text-[8px] opacity-70 leading-tight">{t.desc.split(' (')[0]}</p>
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="w-full bg-white text-black h-12 rounded-xl font-black text-sm hover:bg-gray-200 transition-all cursor-pointer"
          >
            Lancer le Projet
          </button>
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
              Enregistrer les paramètres
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
          Se déconnecter
        </button>
      </form>
    </div>
  );
};

export default Settings;
