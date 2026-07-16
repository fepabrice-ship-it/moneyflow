import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { App as CapApp } from '@capacitor/app';
import {
  LayoutDashboard,
  Boxes,
  Settings as SettingsIcon,
  Shield,
  Plus,
  LogOut,
  Loader2,
  PieChart
} from 'lucide-react';
import Auth from './components/Auth';
import UpdatePassword from './components/UpdatePassword';
import Dashboard from './components/Dashboard';
import TransactionModal from './components/TransactionModal';
import Settings from './components/Settings';
import TransactionsList from './components/TransactionsList';
import Statistics from './components/Statistics';
import Inventory from './components/Inventory';
import AntiVol from './components/AntiVol';
import Onboarding from './components/Onboarding';
import PullToRefresh from './components/PullToRefresh';

import { ProjectProvider, useProject } from './contexts/ProjectContext';
import SplashScreen from './components/SplashScreen';
import { AnimatePresence, motion } from 'framer-motion';
import { seedMissingCategories } from './lib/seedCategories';

const BASE_NAV_ITEMS = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
  { id: 'statistics', label: 'Statistiques', icon: PieChart },
  { id: 'inventory', label: 'Produits', icon: Boxes },
];

const AppContent = ({ onLogout, onRefresh, showAddModal, setShowAddModal, editingTransaction, setEditingTransaction, activeTab, setActiveTab }) => {
  const { currentProject, projects, loading: projectLoading } = useProject();
  const isOwner = currentProject?.role === 'owner';
  const isBusiness = currentProject?.type === 'continuous';

  // Quand on change de projet, on ramène immédiatement l'utilisateur au tableau
  // de bord (le premier chargement est ignoré : on y est déjà par défaut).
  const previousProjectId = useRef(null);
  useEffect(() => {
    if (!currentProject?.id) return;
    if (previousProjectId.current && previousProjectId.current !== currentProject.id) {
      setActiveTab('dashboard');
    }
    previousProjectId.current = currentProject.id;
  }, [currentProject?.id, setActiveTab]);
  // L'onglet Anti-vol n'apparaît que pour l'owner d'un projet business : sur
  // un projet personnel il n'y a pas d'employés à surveiller, l'outil n'a
  // donc aucune raison d'être affiché.
  const NAV_ITEMS = (isOwner && isBusiness)
    ? [...BASE_NAV_ITEMS, { id: 'antivol', label: 'Anti-vol', icon: Shield }]
    : BASE_NAV_ITEMS;

  if (projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (projects.length === 0) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden relative">
      {/* Mobile Fixed Header - TOP LEVEL */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-[100] bg-background/80 backdrop-blur-xl border-b border-white/5 py-4 px-6 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-xl object-contain shadow-lg" />
          <h1 className="text-xl font-black tracking-tighter">
            Money<span className="text-primary">Flow</span>
          </h1>
        </div>
        <button
          onClick={() => setActiveTab('settings')}
          aria-label="Paramètres"
          className={`p-2 rounded-xl transition-all ${
            activeTab === 'settings' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-white'
          }`}
        >
          <SettingsIcon size={22} />
        </button>
      </header>

      <div className="lg:flex">
        {/* Transaction Modal */}
        <TransactionModal 
          isOpen={showAddModal || !!editingTransaction} 
          editingTransaction={editingTransaction}
          onClose={() => {
            setShowAddModal(false);
            setEditingTransaction(null);
          }} 
          onRefresh={onRefresh}
        />

        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-white/5 p-6 h-screen sticky top-0">
          <div className="mb-8">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
              <h1 className="text-xl font-black tracking-tighter">MoneyFlow <span className="bg-primary/20 text-primary text-[8px] px-1 rounded">V1.5</span></h1>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Brayce Edition</p>
          </div>

          {/* Project Selector moved to Settings */}

          <nav className="flex-1 space-y-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                  activeTab === item.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === 'settings'
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'text-muted-foreground hover:bg-white/5 hover:text-white'
            }`}
          >
            <SettingsIcon size={20} />
            Paramètres
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-red-500 transition-colors mt-2 rounded-xl hover:bg-red-500/5"
          >
            <LogOut size={20} />
            Déconnexion
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full pb-32 lg:pb-10 pt-20 lg:pt-10">
          <PullToRefresh onRefresh={onRefresh}>
          {activeTab === 'dashboard' && (
            <Dashboard
              onViewAll={() => setActiveTab('transactions')}
            />
          )}
          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'antivol' && <AntiVol onClose={() => setActiveTab('dashboard')} />}
          {activeTab === 'transactions' && (
            <TransactionsList onEdit={setEditingTransaction} />
          )}
          {activeTab === 'statistics' && <Statistics />}
          </PullToRefresh>
        </main>
      </div>

      {/* Mobile Sticky Add Button */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/40 z-50 hover:scale-110 active:scale-95 transition-transform"
      >
        <Plus size={28} />
      </button>

      {/* Mobile Bottom Navigation & Project Selector */}
      <nav className="fixed bottom-6 left-6 right-6 lg:hidden z-40 space-y-4">
        {/* Mobile Project Selector moved to Settings */}

        <div className="h-20 bg-muted/80 backdrop-blur-xl border border-white/5 rounded-2xl p-2 flex items-stretch justify-around shadow-2xl">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-xl transition-all cursor-pointer ${
                activeTab === item.id ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              }`}
            >
              <item.icon size={22} />
              <span className="text-[10px] font-bold tracking-tight leading-none">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });
  const [projectsReady, setProjectsReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabHistory, setTabHistory] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Navigation wrappée : empile l'onglet courant pour permettre le retour Android.
  const navigateTab = useCallback((next) => {
    setActiveTab((prev) => {
      if (prev === next) return prev;
      setTabHistory((h) => [...h, prev]);
      return next;
    });
  }, []);

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setShowSplash(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        seedMissingCategories();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setProjectsReady(false);
      // À la connexion, on repart toujours du tableau de bord (l'app ne se
      // démonte pas au logout, l'onglet précédent pourrait sinon persister).
      if (event === 'SIGNED_IN') {
        setActiveTab('dashboard');
        setTabHistory([]);
        setShowAddModal(false);
        setEditingTransaction(null);
      }
      // Lien de réinitialisation cliqué : on affiche l'écran de nouveau
      // mot de passe avant de laisser entrer dans l'application.
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
      if (event === 'SIGNED_OUT') {
        setRecoveryMode(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Bouton retour Android : ferme un modal ouvert, sinon revient à l'onglet
  // précédent, sinon quitte l'application.
  useEffect(() => {
    let handle;
    const onBack = () => {
      if (showAddModal || editingTransaction) {
        setShowAddModal(false);
        setEditingTransaction(null);
        return;
      }
      setTabHistory((h) => {
        if (h.length === 0) {
          CapApp.exitApp();
          return h;
        }
        const previous = h[h.length - 1];
        setActiveTab(previous);
        return h.slice(0, -1);
      });
    };
    CapApp.addListener('backButton', onBack).then((h) => { handle = h; }).catch(() => {});
    return () => { if (handle) handle.remove(); };
  }, [showAddModal, editingTransaction]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleRefresh = () => {
    window.dispatchEvent(new CustomEvent('refresh-data'));
  };

  // Pré-chargement : on considère l'app prête quand la session est résolue
  // ET (pas de session OU les projets sont chargés). Le splash attend ce signal.
  const appReady = !loading && (!session || recoveryMode || projectsReady);

  const content = loading ? (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  ) : !session ? (
    <Auth />
  ) : recoveryMode ? (
    <UpdatePassword onDone={() => setRecoveryMode(false)} />
  ) : (
    <ProjectProvider session={session} onReady={() => setProjectsReady(true)}>
      <AppContent
        session={session}
        onLogout={handleLogout}
        onRefresh={handleRefresh}
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        editingTransaction={editingTransaction}
        setEditingTransaction={setEditingTransaction}
        activeTab={activeTab}
        setActiveTab={navigateTab}
      />
    </ProjectProvider>
  );

  return (
    <>
      {content}
      <AnimatePresence>
        {showSplash && (
          <SplashScreen
            key="splash"
            ready={appReady}
            onComplete={() => setShowSplash(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default App;
