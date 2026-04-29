import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Phone, CreditCard, ChevronRight, CheckCircle2, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';

const CustomerManagement = () => {
  const { currentProject } = useProject();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentProject) {
      fetchCustomers();
    }
  }, [currentProject]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      // Fetch customers and their unpaid transactions to calculate debt
      const { data: customersData, error: custError } = await supabase
        .from('customers')
        .select(`
          *,
          transactions(amount, payment_status)
        `)
        .eq('project_id', currentProject.id)
        .order('name');

      if (custError) throw custError;

      const formattedCustomers = customersData.map(c => {
        const debt = c.transactions
          ?.filter(t => t.payment_status === 'unpaid')
          ?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
        return { ...c, total_debt: debt };
      });

      setCustomers(formattedCustomers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('customers')
        .insert([{ ...newCustomer, project_id: currentProject.id }]);
      
      if (error) throw error;
      
      setShowAddModal(false);
      setNewCustomer({ name: '', phone: '' });
      fetchCustomers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSettleDebt = async (customerId) => {
    if (!confirm('Voulez-vous marquer toutes les dettes de ce client comme payées ?')) return;
    
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ payment_status: 'paid' })
        .eq('customer_id', customerId)
        .eq('payment_status', 'unpaid');
      
      if (error) throw error;
      fetchCustomers();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone && c.phone.includes(searchQuery))
  );

  if (loading && customers.length === 0) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">L'Ardoise</h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Gestion des clients et des dettes</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer active:scale-95 transition-all"
        >
          <UserPlus size={16} />
          Nouveau Client
        </button>
      </header>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <input 
          type="text"
          placeholder="Rechercher un client..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:border-primary outline-none transition-all"
        />
      </div>

      {/* Customers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCustomers.map((customer) => (
          <div key={customer.id} className="glass-card p-5 group hover:border-primary/30 transition-all">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl font-black text-primary border border-white/10">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{customer.name}</h3>
                  {customer.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone size={10} /> {customer.phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Dette Totale</p>
                <p className={`text-xl font-black ${customer.total_debt > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                  {new Intl.NumberFormat('fr-FR').format(customer.total_debt)} FCFA
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
              <div className="flex items-center gap-1">
                {customer.total_debt > 0 ? (
                  <span className="px-2 py-0.5 bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase rounded tracking-tighter">En attente</span>
                ) : (
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[8px] font-black uppercase rounded tracking-tighter">À jour</span>
                )}
              </div>
              
              {customer.total_debt > 0 && (
                <button 
                  onClick={() => handleSettleDebt(customer.id)}
                  className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline cursor-pointer"
                >
                  Tout régler <CheckCircle2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredCustomers.length === 0 && (
          <div className="col-span-full py-20 text-center glass-card border-dashed">
            <p className="text-muted-foreground italic">Aucun client trouvé.</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-sm bg-muted border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Nouveau Client</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nom complet</label>
                <input 
                  autoFocus
                  required
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-xl py-3 px-4 text-sm focus:border-primary outline-none"
                  placeholder="Ex: M. Tanko"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Téléphone (Optionnel)</label>
                <input 
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-xl py-3 px-4 text-sm focus:border-primary outline-none"
                  placeholder="6xx xxx xxx"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-white text-black py-3 rounded-xl font-black text-sm active:scale-95 transition-all mt-4"
              >
                Créer le client
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;
