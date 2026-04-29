import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { 
  LayoutDashboard, 
  Receipt, 
  Wallet, 
  Settings as SettingsIcon, 
  Plus, 
  LogOut,
  Loader2,
  PieChart
} from 'lucide-react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import TransactionModal from './components/TransactionModal';
import Settings from './components/Settings';
import Budgets from './components/Budgets';
import TransactionsList from './components/TransactionsList';
import Statistics from './components/Statistics';
import Onboarding from './components/Onboarding';

import { ProjectProvider, useProject } from './contexts/ProjectContext';

const AppContent = ({ onLogout, onRefresh, showAddModal, setShowAddModal, editingTransaction, setEditingTransaction, activeTab, setActiveTab }) => {
  const { currentProject, projects, loading: projectLoading } = useProject();

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
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-white font-black text-xs">MF</span>
          </div>
          <h1 className="text-xl font-black tracking-tighter">
            Money<span className="text-primary">Flow</span>
          </h1>
        </div>
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
            <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">MoneyFlow <span className="bg-primary/20 text-primary text-[8px] px-1 rounded">V1.1</span></h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Brayce Edition</p>
          </div>

          {/* Project Selector moved to Settings */}

          <nav className="flex-1 space-y-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'budgets', label: 'Budgets', icon: Wallet },
              { id: 'statistics', label: 'Statistiques', icon: PieChart },
              { id: 'transactions', label: 'Transactions', icon: Receipt },
              { id: 'settings', label: 'Paramètres', icon: SettingsIcon },
            ].map((item) => (
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
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-red-500 transition-colors mt-auto rounded-xl hover:bg-red-500/5"
          >
            <LogOut size={20} />
            Déconnexion
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full pb-32 lg:pb-10 pt-20 lg:pt-10">
          {activeTab === 'dashboard' && (
            <Dashboard 
              onViewAll={() => setActiveTab('transactions')} 
            />
          )}
          {activeTab === 'budgets' && <Budgets />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'transactions' && (
            <TransactionsList onEdit={setEditingTransaction} />
          )}
          {activeTab === 'statistics' && <Statistics />}
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

        <div className="h-16 bg-muted/80 backdrop-blur-xl border border-white/5 rounded-2xl p-2 flex items-center justify-around shadow-2xl">
          {[
            { id: 'dashboard', icon: LayoutDashboard },
            { id: 'budgets', icon: Wallet },
            { id: 'statistics', icon: PieChart },
            { id: 'transactions', icon: Receipt },
            { id: 'settings', icon: SettingsIcon },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                activeTab === item.id ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              }`}
            >
              <item.icon size={24} />
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleRefresh = () => {
    // This will trigger re-renders in components that fetch on mount/effect
    window.dispatchEvent(new CustomEvent('refresh-data'));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <ProjectProvider session={session}>
      <AppContent 
        session={session}
        onLogout={handleLogout}
        onRefresh={handleRefresh}
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        editingTransaction={editingTransaction}
        setEditingTransaction={setEditingTransaction}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </ProjectProvider>
  );
};

export default App;
