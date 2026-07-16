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
  Info,
  Package,
  Plus,
  Trash2,
  AlertCircle,
  Briefcase,
  Layout,
  Rocket,
  RefreshCcw,
  TrendingUp,
  Tag,
  Pencil,
  Wallet,
  X
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import DailyClosingSection from './DailyClosingSection';
import Budgets from './Budgets';
import { computeAllProductStocks, createOpeningStockTransaction } from '../lib/stockUtils';

const PROJECT_TYPES = [
  { 
    id: 'standard', 
    name: 'Standard', 
    desc: 'Gère ton argent du mois (salaire, argent de poche, etc.) chaque mois simplement.',
    details: 'Chaque nouveau mois recommence à zéro, et tu dois définir ton budget du mois.',
    color: 'bg-blue-500'
  },
  { 
    id: 'continuous', 
    name: 'Business', 
    desc: 'Suis l’argent de ton activité au quotidien.',
    details: 'L’argent restant continue le mois suivant.',
    color: 'bg-green-500'
  }
];

const Settings = () => {
  const { currentProject, projects, selectProject, createProject, updateProject, deleteProject, refreshProjects } = useProject();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  
  // Create Project Flow State
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState('standard');
  const [isCreating, setIsCreating] = useState(false);
  
  const [renameProjectName, setRenameProjectName] = useState(currentProject?.name || '');
  const [renameProjectType, setRenameProjectType] = useState(currentProject?.type || 'standard');
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState(null);
  
  const [profile, setProfile] = useState({
    full_name: ''
  });

  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', purchase_price: '', stock_quantity: '', alert_threshold: 5 });
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', type: 'expense' });
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [showBudgets, setShowBudgets] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (currentProject) {
      setRenameProjectName(currentProject.name);
      setRenameProjectType(currentProject.type || 'standard');
      fetchProducts();
      fetchCategories();
    }
  }, [currentProject]);

  const fetchProducts = async () => {
    if (!currentProject) return;
    const [prodRes, txRes] = await Promise.all([
      supabase.from('products').select('*').eq('project_id', currentProject.id).order('name'),
      supabase.from('transactions').select('product_id, quantity, categories(name)').eq('project_id', currentProject.id),
    ]);
    const stockMap = computeAllProductStocks(txRes.data || []);
    const list = (prodRes.data || []).map(p => ({ ...p, derivedStock: stockMap[p.id] ?? 0 }));
    setProducts(list);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name) return;
    setIsAddingCategory(true);
    try {
      const { error } = await supabase
        .from('categories')
        .insert([newCategory]);
      if (error) throw error;
      setNewCategory({ name: '', type: 'expense' });
      fetchCategories();
      alert('Catégorie ajoutée !');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Supprimer cette catégorie ?')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      fetchCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setIsAddingProduct(true);
    try {
      // stock_quantity n'est plus la source de vérité → on ne le pousse plus.
      // Si l'utilisateur saisit un stock initial à la création, on crée une
      // transaction "Stock initial" (exclude_from_global) pour matérialiser
      // ce solde dans la dérivation.
      const purchasePrice = parseFloat(newProduct.purchase_price) || 0;
      const payload = {
        name: newProduct.name,
        purchase_price: purchasePrice,
        alert_threshold: parseFloat(newProduct.alert_threshold) || 5,
        project_id: currentProject.id,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);
        if (error) throw error;
        setEditingProduct(null);
      } else {
        const { data: created, error } = await supabase
          .from('products')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        const initialQty = parseFloat(newProduct.stock_quantity) || 0;
        if (initialQty > 0 && created) {
          const { data: { user } } = await supabase.auth.getUser();
          await createOpeningStockTransaction({
            projectId: currentProject.id,
            userId: user?.id,
            productId: created.id,
            qty: initialQty,
            unitCost: purchasePrice,
          });
        }
      }

      setNewProduct({ name: '', purchase_price: '', stock_quantity: '', alert_threshold: 5 });
      fetchProducts();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      await supabase.from('products').delete().eq('id', id);
      fetchProducts();
    } catch (err) {
      alert(err.message);
    }
  };

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

  const handleDeleteProject = async () => {
    if (!currentProject) return;
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le projet "${currentProject.name}" ? Cette action est irréversible et supprimera toutes les transactions associées.`)) return;
    
    setLoading(true);
    try {
      await deleteProject(currentProject.id);
      alert('Projet supprimé !');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
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
    if (e) e.preventDefault();
    if (!newProjectName) return;
    setIsCreating(true);
    try {
      await createProject(newProjectName, newProjectType);
      setNewProjectName('');
      setShowCreateFlow(false);
      setCreateStep(1);
      alert('Projet créé avec succès !');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (fetching) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-[10px] mt-1">Gérez vos comptes et vos préférences</p>
      </header>

      {/* Budgets Access */}
      <button
        onClick={() => setShowBudgets(true)}
        className="w-full glass-card p-5 flex items-center justify-between group hover:border-primary/30 transition-all text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-all">
            <Wallet size={20} />
          </div>
          <div>
            <p className="font-bold text-sm">Budgets</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Définissez vos limites par catégorie</p>
          </div>
        </div>
        <ChevronRight size={20} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </button>

      {/* Projects Management */}
      <div className="glass-card p-0 overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary">
            <Briefcase size={20} />
            <h2 className="font-bold uppercase tracking-widest text-xs">Mes Projets</h2>
          </div>
          <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-1 rounded-full">
            {projects.length} ACTIFS
          </span>
        </div>

        <div className="divide-y divide-white/5">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                if (currentProject?.id !== p.id) {
                  setPendingSwitch(p.id);
                }
              }}
              className={`w-full p-5 flex items-center justify-between group transition-all cursor-pointer ${
                currentProject?.id === p.id ? 'bg-primary/[0.03]' : 
                pendingSwitch === p.id ? 'bg-white/10 ring-inset ring-1 ring-primary/30' : 'hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  currentProject?.id === p.id 
                  ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                  : pendingSwitch === p.id
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-white/5 text-muted-foreground group-hover:bg-white/10 group-hover:text-white'
                }`}>
                  {p.type === 'continuous' ? <RefreshCcw size={20} /> : <Target size={20} />}
                </div>
                <div className="text-left">
                  <p className={`font-bold text-sm ${currentProject?.id === p.id || pendingSwitch === p.id ? 'text-white' : 'text-muted-foreground group-hover:text-white'}`}>
                    {p.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    {PROJECT_TYPES.find(t => t.id === p.type)?.name || 'Standard'} • {p.role === 'owner' ? 'Propriétaire' : 'Membre'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {currentProject?.id === p.id ? (
                  <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter">
                    Actif
                  </div>
                ) : pendingSwitch === p.id ? (
                  <div className="bg-white text-black px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-lg shadow-white/20 animate-pulse">
                    Sélectionné
                  </div>
                ) : (
                  <div className="opacity-0 lg:group-hover:opacity-100 bg-white/5 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all">
                    Choisir
                  </div>
                )}
              </div>
            </div>
          ))}

          {pendingSwitch && (
            <div className="p-6 bg-primary/10 border-t border-primary/20 space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <Info size={14} /> Confirmation requise
                </p>
                <button 
                  onClick={() => setPendingSwitch(null)}
                  className="text-[10px] font-black text-muted-foreground hover:text-white uppercase tracking-widest transition-colors"
                >
                  Annuler
                </button>
              </div>
              
              <button
                onClick={() => {
                  const p = projects.find(proj => proj.id === pendingSwitch);
                  if (p) selectProject(p);
                  setPendingSwitch(null);
                }}
                className="w-full bg-primary text-white h-12 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                <RefreshCcw size={18} />
                Changer vers "{projects.find(proj => proj.id === pendingSwitch)?.name}"
              </button>
            </div>
          )}

          {!showCreateFlow ? (
            <button
              onClick={() => setShowCreateFlow(true)}
              className="w-full p-5 flex items-center gap-4 group transition-all hover:bg-primary/5 text-primary"
            >
              <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-primary/30 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/50 transition-all">
                <Plus size={24} />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm uppercase tracking-widest">Ajouter un nouveau projet</p>
                <p className="text-[9px] text-primary/60 mt-0.5">Créez un nouvel espace pour vos finances</p>
              </div>
            </button>
          ) : (
            <div className="p-6 bg-primary/5 border-t-2 border-primary/20 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <Rocket size={14} /> 
                  {createStep === 1 ? 'Étape 1: Nom' : 'Étape 2: Logique'}
                </h3>
                <button 
                  onClick={() => {
                    setShowCreateFlow(false);
                    setCreateStep(1);
                  }}
                  className="text-[10px] font-bold text-muted-foreground hover:text-white uppercase tracking-widest transition-colors"
                >
                  Annuler
                </button>
              </div>

              {createStep === 1 ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <input
                    type="text"
                    autoFocus
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && newProjectName && setCreateStep(2)}
                    placeholder="Nom du projet (ex: Business Burger)"
                    className="w-full bg-background border border-primary/20 rounded-xl py-4 px-5 text-lg font-bold focus:border-primary outline-none transition-all"
                  />
                  <button
                    disabled={!newProjectName}
                    onClick={() => setCreateStep(2)}
                    className="w-full bg-primary text-white h-12 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-30"
                  >
                    Suivant <ChevronRight size={18} />
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 gap-2">
                    {PROJECT_TYPES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNewProjectType(t.id)}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all text-left group ${
                          newProjectType === t.id 
                          ? 'bg-white text-black border-white shadow-xl scale-[1.02]' 
                          : 'bg-background border-white/5 hover:border-white/10 text-muted-foreground'
                        }`}
                      >
                        <div className="mt-1 flex items-center justify-center">
                          {t.id === 'continuous' ? <RefreshCcw size={16} /> : <Target size={16} />}
                        </div>
                        <div>
                          <p className={`font-bold text-xs uppercase tracking-widest ${newProjectType === t.id ? 'text-black' : 'text-white'}`}>
                            {t.name}
                          </p>
                          <p className="text-[9px] opacity-70 mt-0.5">{t.desc.split(' (')[0]}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setCreateStep(1)}
                      className="px-6 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Retour
                    </button>
                    <button
                      disabled={isCreating}
                      onClick={handleCreateProject}
                      className="flex-1 bg-primary text-white h-12 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                    >
                      {isCreating ? <Loader2 className="animate-spin" size={18} /> : <><Rocket size={18} /> Lancer le Projet</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isUpdating}
                className="flex-1 bg-primary text-white h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isUpdating ? <Loader2 className="animate-spin" size={18} /> : 'Mettre à jour'}
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                className="px-6 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-sm hover:bg-red-500/20 transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 bg-white/5 rounded-xl flex items-center gap-3">
            <Info size={18} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Seul le propriétaire peut modifier le type du projet.</p>
          </div>
        )}

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

      {/* Category Management */}
      <div className="glass-card space-y-6">
        <div className="flex items-center gap-3 text-primary">
          <Tag size={20} />
          <h2 className="font-bold">Gestion des Catégories</h2>
        </div>

        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2 p-4 bg-white/5 rounded-2xl border border-white/5">
          <input
            required
            type="text"
            value={newCategory.name}
            onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
            className="flex-1 bg-background border border-white/5 rounded-xl py-3 px-4 text-sm focus:border-primary outline-none"
            placeholder="Nouvelle catégorie (ex: Expédition)"
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={newCategory.type}
              onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value })}
              className="flex-1 sm:w-32 bg-background border border-white/5 rounded-xl py-3 px-4 text-xs font-bold focus:border-primary outline-none appearance-none"
            >
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
            </select>
            <button
              type="submit"
              disabled={isAddingCategory}
              className="bg-primary text-white px-6 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 min-w-[50px]"
            >
              {isAddingCategory ? <Loader2 className="animate-spin" size={14} /> : <Plus size={18} />}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-2 bg-background border border-white/5 rounded-lg group">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold truncate max-w-[80px]">{cat.name}</span>
                <span className={`text-[8px] uppercase font-black ${cat.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                  {cat.type === 'income' ? 'In' : 'Out'}
                </span>
              </div>
              <button 
                onClick={() => handleDeleteCategory(cat.id)}
                className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Point de Caisse Section (Business only) */}
      <DailyClosingSection />

      {/* Product Management (Business only) */}
      {currentProject?.type === 'continuous' && currentProject?.role === 'owner' && (
        <div className="glass-card space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary">
              <Package size={20} />
              <h2 className="font-bold">{editingProduct ? 'Modifier le Produit' : 'Gestion du Stock'}</h2>
            </div>
            {editingProduct && (
              <button 
                onClick={() => {
                  setEditingProduct(null);
                  setNewProduct({ name: '', purchase_price: '', stock_quantity: '', alert_threshold: 5 });
                }}
                className="text-[10px] font-black text-muted-foreground hover:text-white uppercase tracking-widest transition-colors"
              >
                Annuler
              </button>
            )}
          </div>

          <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 shadow-xl shadow-black/20">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nom du Produit</label>
              <input
                required
                type="text"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="w-full bg-background border border-white/5 rounded-xl py-2 px-4 text-sm focus:border-primary outline-none"
                placeholder="Ex: Sac de Riz 25kg"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Prix d'Achat (FCFA)</label>
              <input
                required
                type="number"
                value={newProduct.purchase_price}
                onChange={(e) => setNewProduct({ ...newProduct, purchase_price: e.target.value })}
                className="w-full bg-background border border-white/5 rounded-xl py-2 px-4 text-sm focus:border-primary outline-none"
                placeholder="0"
              />
            </div>
            {!editingProduct && (
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Stock Initial</label>
                <input
                  type="number"
                  value={newProduct.stock_quantity}
                  onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-xl py-2 px-4 text-sm focus:border-primary outline-none"
                  placeholder="0"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Seuil d'Alerte</label>
              <input
                required
                type="number"
                value={newProduct.alert_threshold}
                onChange={(e) => setNewProduct({ ...newProduct, alert_threshold: e.target.value })}
                className="w-full bg-background border border-white/5 rounded-xl py-2 px-4 text-sm focus:border-primary outline-none"
                placeholder="5"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isAddingProduct}
                className="w-full bg-primary text-white h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {isAddingProduct ? <Loader2 className="animate-spin" size={14} /> : (
                  editingProduct ? <><Save size={14} /> Enregistrer</> : <><Plus size={14} /> Ajouter au Stock</>
                )}
              </button>
            </div>
          </form>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {products.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-background border border-white/5 rounded-xl group">
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{p.name}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Coût: {new Intl.NumberFormat('fr-FR').format(p.purchase_price)} FCFA</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-xs font-black ${p.derivedStock <= p.alert_threshold ? 'text-orange-500' : 'text-green-500'}`}>
                      {p.derivedStock} en stock
                    </p>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-tighter">Alerte à {p.alert_threshold}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingProduct(p);
                        setNewProduct({
                          name: p.name,
                          purchase_price: p.purchase_price,
                          stock_quantity: '',
                          alert_threshold: p.alert_threshold
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                      title="Modifier"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(p.id)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <p className="text-center py-4 text-xs text-muted-foreground italic">Aucun produit configuré.</p>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
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

      {showBudgets && (
        <div className="fixed inset-0 z-[250] bg-muted overflow-y-auto p-6 animate-in slide-in-from-right duration-300">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setShowBudgets(false)}
              className="mb-8 flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
            >
              <X size={20} /> Retour aux Paramètres
            </button>
            <Budgets />
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
