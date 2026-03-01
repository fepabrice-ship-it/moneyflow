import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { 
  LayoutDashboard, 
  Receipt, 
  Wallet, 
  Settings as SettingsIcon, 
  Plus, 
  LogOut,
  Loader2
} from 'lucide-react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import TransactionModal from './components/TransactionModal';
import Settings from './components/Settings';
import Budgets from './components/Budgets';
import TransactionsList from './components/TransactionsList';

const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const dashboardRef = useRef(null);

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
    if (dashboardRef.current) {
      dashboardRef.current.refresh();
    }
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
    <div className="min-h-screen bg-background text-foreground lg:flex">
      {/* Transaction Modal */}
      <TransactionModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onRefresh={handleRefresh}
      />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-white/5 p-6 h-screen sticky top-0">
        <div className="mb-10">
          <h1 className="text-xl font-black tracking-tighter">MoneyFlow</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Brayce Edition</p>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'budgets', label: 'Budgets', icon: Wallet },
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
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-red-500 transition-colors mt-auto rounded-xl hover:bg-red-500/5"
        >
          <LogOut size={20} />
          Déconnexion
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full pb-32 lg:pb-10">
        {activeTab === 'dashboard' && (
          <Dashboard 
            ref={dashboardRef} 
            onViewAll={() => setActiveTab('transactions')} 
          />
        )}
        {activeTab === 'budgets' && <Budgets />}
        {activeTab === 'settings' && <Settings />}
        {activeTab === 'transactions' && <TransactionsList />}
        {/* Other future modules */}

      </main>

      {/* Mobile Sticky Add Button */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/40 z-50 hover:scale-110 active:scale-95 transition-transform"
      >
        <Plus size={28} />
      </button>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-6 left-6 right-6 h-16 bg-muted/80 backdrop-blur-xl border border-white/5 rounded-2xl p-2 flex items-center justify-around lg:hidden z-40 shadow-2xl">
        {[
          { id: 'dashboard', icon: LayoutDashboard },
          { id: 'budgets', icon: Wallet },
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
      </nav>
    </div>
  );
};

export default App;
