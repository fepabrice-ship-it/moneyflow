import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Receipt, DollarSign, Calendar, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TransactionModal = ({ isOpen, onClose, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense',
    category_id: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) {
      setCategories(data);
      // Set default category if none selected
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, category_id: data[0].id }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('transactions').insert([
        {
          ...formData,
          amount: parseFloat(formData.amount),
          user_id: user.id
        }
      ]);

      if (error) throw error;
      
      onRefresh();
      onClose();
      setFormData({
        description: '',
        amount: '',
        type: 'expense',
        category_id: categories[0]?.id || '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Drawer/Modal */}
      <div className="relative w-full max-w-lg bg-muted border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-300">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-xl font-bold">Nouvelle Opération</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Type Toggle */}
          <div className="flex p-1 bg-background rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'expense' })}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${formData.type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-muted-foreground'}`}
            >
              Dépense
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'income' })}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${formData.type === 'income' ? 'bg-green-500 text-white shadow-lg' : 'text-muted-foreground'}`}
            >
              Revenu
            </button>
          </div>

          <div className="space-y-4">
            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Montant (FCFA)</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black focus:border-primary outline-none transition-all placeholder:text-muted-foreground/30"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Description</label>
              <div className="relative">
                <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="text"
                  required
                  placeholder="Ex: Abonnement Salle de sport"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:border-primary outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Category */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Catégorie</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full bg-background border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:border-primary outline-none appearance-none transition-all"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-background border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black h-14 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50 mt-4 shadow-xl shadow-white/5"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : (
              <>
                <Save size={20} />
                Enregistrer
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
