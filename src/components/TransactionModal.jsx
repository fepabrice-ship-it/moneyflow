import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Receipt, DollarSign, Calendar, Tag, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';

const TransactionModal = ({ isOpen, onClose, onRefresh, editingTransaction = null }) => {
  const { currentProject, members } = useProject();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense',
    category_id: '',
    user_id: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        setFormData({
          description: editingTransaction.description,
          amount: editingTransaction.amount.toString(),
          type: editingTransaction.type,
          category_id: editingTransaction.category_id,
          user_id: editingTransaction.user_id,
          date: editingTransaction.date
        });
      } else {
        // Default for new transaction
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            setFormData(prev => ({ 
              ...prev, 
              user_id: user.id,
              description: '',
              amount: '',
              type: 'expense',
              date: new Date().toISOString().split('T')[0]
            }));
          }
        });
      }
      fetchCategories();
    }
  }, [isOpen, editingTransaction]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) {
      setCategories(data);
      if (!editingTransaction && data.length > 0) {
        setFormData(prev => ({ ...prev, category_id: data[0].id }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentProject) return;
    setLoading(true);
    
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        project_id: currentProject.id
      };

      let error;
      if (editingTransaction) {
        const { error: updateError } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', editingTransaction.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('transactions')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Drawer/Modal */}
      <div className="relative w-full max-w-lg bg-muted border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-300 max-h-[92vh] flex flex-col">
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-4 mb-2 shrink-0" />

        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-muted shrink-0">
          <h2 className="text-lg font-bold">{editingTransaction ? 'Modifier' : 'Nouv. Opération'}</h2>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* Type Toggle */}
          <div className="flex p-1 bg-background rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'expense' })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${formData.type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-muted-foreground'}`}
            >
              Dépense
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'income' })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${formData.type === 'income' ? 'bg-green-500 text-white shadow-lg' : 'text-muted-foreground'}`}
            >
              Revenu
            </button>
          </div>

          <div className="space-y-3">
            {/* Amount Input */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Montant (FCFA)</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-xl py-3 pl-12 pr-4 text-xl font-black focus:border-primary outline-none transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Description</label>
              <div className="relative">
                <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  required
                  placeholder="Libellé..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-xl py-2.5 pl-12 pr-4 text-sm focus:border-primary outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Catégorie</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full bg-background border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:border-primary outline-none appearance-none transition-all"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-background border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Responsible Person Selector (Compact) */}
            <div className="border-t border-white/5 pt-3">
              <label className="text-[9px] font-bold uppercase tracking-widest text-primary ml-1 block mb-2">Responsable</label>
              
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => {
                  const isSelected = formData.user_id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, user_id: m.id })}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${
                        isSelected 
                        ? 'bg-primary/10 border-primary' 
                        : 'bg-background border-white/5'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                        isSelected ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground'
                      }`}>
                        {m.full_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <p className={`text-[10px] font-bold truncate ${isSelected ? 'text-white' : 'text-muted-foreground'}`}>
                        {m.full_name}
                      </p>
                      {isSelected && <Check size={10} className="text-primary ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black h-12 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-white/5 cursor-pointer"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <Save size={16} />
                {editingTransaction ? 'Enregistrer' : 'Créer'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
