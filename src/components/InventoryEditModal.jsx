import React, { useState, useEffect } from 'react';
import { X, Loader2, Pencil, Trash2, Plus, Package, MapPin, ArrowUpRight, ArrowDownLeft, Globe, Tag, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import TransactionModal from './TransactionModal';
import { normalizeCity } from '../lib/cityUtils';
import { logActivity, summarizeTransaction } from '../lib/audit';

const InventoryEditModal = ({ isOpen, onClose, product, city, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);

  useEffect(() => {
    if (isOpen && product && city) {
      fetchTransactions();
    }
  }, [isOpen, product, city]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      // On récupère tous les mouvements du produit puis on filtre côté client
      // sur la ville normalisée (tolérant aux accents / fautes d'orthographe).
      const { data, error } = await supabase
        .from('transactions')
        .select('*, categories(name, type), profiles(full_name)')
        .eq('product_id', product.id)
        .order('date', { ascending: false });

      if (error) throw error;
      const filtered = (data || []).filter(t => normalizeCity(t.town) === city);
      setTransactions(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette opération de stock ?')) return;
    try {
      const before = transactions.find(t => t.id === id);
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      logActivity({
        projectId: before?.project_id,
        action: 'delete',
        entityType: 'transaction',
        entityId: id,
        summary: `Suppression mouvement stock : ${summarizeTransaction(before)}`,
        before,
      });
      setTransactions(transactions.filter(t => t.id !== id));
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-muted border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-muted/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Package size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">{product.name}</h2>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                <MapPin size={10} className="text-primary" />
                <span>{city}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAddingTransaction(true)}
              className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20"
            >
              <Plus size={20} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : transactions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Historique des mouvements de stock</p>
              {transactions.map((tx) => (
                <div key={tx.id} className="glass-card p-4 flex items-center justify-between group hover:border-white/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      tx.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {tx.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{tx.description}</p>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                          tx.categories?.name === 'Vente' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'
                        }`}>
                          {tx.categories?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-primary font-black bg-primary/10 px-2 py-0.5 rounded">
                          {tx.categories?.name === 'Vente' ? '-' : '+'}{tx.quantity} pcs
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(tx.date))}
                        </span>
                        <span className="text-[10px] text-white/20">•</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <User size={10} />
                          {tx.profiles?.full_name?.split(' ')[0] || 'Inconnu'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setEditingTransaction(tx)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(tx.id)}
                      className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-60 text-center space-y-4 opacity-50">
              <Package size={48} className="text-muted-foreground" />
              <div>
                <p className="font-bold">Aucun mouvement trouvé</p>
                <p className="text-xs">Aucune transaction n'est liée à ce stock dans cette ville.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-muted shrink-0">
          <button
            onClick={onClose}
            className="w-full h-12 bg-white/10 hover:bg-white/15 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Transaction Modals */}
      {(isAddingTransaction || editingTransaction) && (
        <TransactionModal
          isOpen={true}
          onClose={() => {
            setIsAddingTransaction(false);
            setEditingTransaction(null);
          }}
          onRefresh={() => {
            fetchTransactions();
            onRefresh();
          }}
          editingTransaction={editingTransaction}
          initialData={{
            product_id: product.id,
            town: city,
            type: 'income', // Default to income (Stock In) but user can toggle
          }}
        />
      )}
    </div>
  );
};

export default InventoryEditModal;
