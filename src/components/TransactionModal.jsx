import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Receipt, DollarSign, Calendar, Tag, Check, AlertCircle, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { logActivity, summarizeTransaction } from '../lib/audit';

const TransactionModal = ({ isOpen, onClose, onRefresh, editingTransaction = null, initialData = null }) => {
  const { currentProject, members } = useProject();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense',
    category_id: '',
    user_id: '',
    date: new Date().toISOString().split('T')[0],
    exclude_from_global: false,
    quantity: 1,
    town: '',
    product_id: '',
    payment_status: 'paid',
    customer_id: ''
  });

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        setFormData({
          description: editingTransaction.description,
          amount: editingTransaction.amount.toString(),
          type: editingTransaction.type,
          category_id: editingTransaction.category_id,
          user_id: editingTransaction.user_id,
          date: editingTransaction.date,
          exclude_from_global: editingTransaction.exclude_from_global || false,
          quantity: editingTransaction.quantity || 1,
          town: editingTransaction.town || '',
          product_id: editingTransaction.product_id || '',
          payment_status: editingTransaction.payment_status || 'paid',
          customer_id: editingTransaction.customer_id || ''
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
              date: new Date().toISOString().split('T')[0],
              exclude_from_global: false,
              quantity: 1,
              town: initialData?.town || '',
              product_id: initialData?.product_id || '',
              payment_status: initialData?.payment_status || 'paid',
              customer_id: initialData?.customer_id || ''
            }));
          }
        });
      }
      fetchCategories();
      fetchProducts();
      fetchCustomers();
    }
  }, [isOpen, editingTransaction]);

  const fetchProducts = async () => {
    if (!currentProject) return;
    const { data } = await supabase.from('products').select('*').eq('project_id', currentProject.id).order('name');
    if (data) setProducts(data);
  };

  const fetchCustomers = async () => {
    if (!currentProject) return;
    const { data } = await supabase.from('customers').select('*').eq('project_id', currentProject.id).order('name');
    if (data) setCustomers(data);
  };

  const BUSINESS_CATEGORIES = ['Vente', 'Achats produits', 'Frais de livraison', 'Loyer', 'Electricité', 'Achats divers', 'Salaire', 'Investissement', 'Expédition', 'Transport produits', 'Publicité'];

  // Quels champs afficher selon la catégorie sélectionnée.
  // Catégorie absente de la table = tous les champs cachés (Salaire, Loyer, etc.).
  const CATEGORY_FIELDS = {
    'Vente':              { quantity: true,  town: true,  product: true  },
    'Achats produits':    { quantity: true,  town: true,  product: true  },
    'Investissement':     { quantity: true,  town: true,  product: true  },
    'Expédition':         { quantity: true,  town: true,  product: true  },
    'Transport produits': { quantity: true,  town: true,  product: true  },
    'Frais de livraison': { quantity: false, town: true,  product: true  },
    'Publicité':          { quantity: false, town: true,  product: false },
  };
  const selectedCatName = categories.find(c => c.id === formData.category_id)?.name;
  const fields = CATEGORY_FIELDS[selectedCatName] || { quantity: false, town: false, product: false };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) {
      let filtered = data;
      if (currentProject?.type === 'continuous') {
        filtered = data.filter(cat => BUSINESS_CATEGORIES.includes(cat.name));
      }
      setCategories(filtered);
      if (!editingTransaction && filtered.length > 0) {
        setFormData(prev => ({ ...prev, category_id: filtered[0].id }));
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
        quantity: parseFloat(formData.quantity) || 1,
        product_id: formData.product_id === '' ? null : formData.product_id,
        customer_id: formData.customer_id === '' ? null : formData.customer_id,
        project_id: currentProject.id
      };

      let error;
      let transactionId;
      let savedRow;

      if (editingTransaction) {
        const { data, error: updateError } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', editingTransaction.id)
          .select()
          .single();
        error = updateError;
        transactionId = data?.id;
        savedRow = data;
      } else {
        const { data, error: insertError } = await supabase
          .from('transactions')
          .insert([payload])
          .select()
          .single();
        error = insertError;
        transactionId = data?.id;
        savedRow = data;
      }

      if (error) throw error;

      // Journal d'activité (best-effort, n'interrompt pas le flux utilisateur)
      logActivity({
        projectId: currentProject.id,
        action: editingTransaction ? 'update' : 'insert',
        entityType: 'transaction',
        entityId: transactionId,
        summary: `${editingTransaction ? 'Modification' : 'Création'} : ${summarizeTransaction(savedRow || payload)}`,
        before: editingTransaction || null,
        after: savedRow || payload,
      });

      // --- STOCK LOGIC ---
      // Le stock n'est PLUS muté directement dans products.stock_quantity :
      // il est dérivé en temps réel depuis les transactions (lib/stockUtils.js)
      // ce qui garantit qu'une suppression/édition de transaction se reflète
      // automatiquement partout. On garde uniquement la trace stock_movements
      // qui sert d'historique d'audit dans Anti-vol.
      const selectedCategory = categories.find(c => c.id === formData.category_id);
      if (formData.product_id && !editingTransaction) {
        const qty = parseFloat(formData.quantity) || 1;
        const isVente = selectedCategory?.name === 'Vente';
        const isAchat = selectedCategory?.name === 'Achats produits' || selectedCategory?.name === 'Investissement';
        if (isVente || isAchat) {
          await supabase.from('stock_movements').insert([{
            product_id: formData.product_id,
            transaction_id: transactionId,
            type: isVente ? 'out' : 'in',
            quantity: qty,
            reason: selectedCategory?.name.toLowerCase()
          }]);
        }
      }
      
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
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
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

          <div className="space-y-4">
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

              {/* Product Selection */}
              {fields.product && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Produit concerné (Optionnel)</label>
                  <div className="relative">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <select
                      value={formData.product_id}
                      onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                      className="w-full bg-background border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:border-primary outline-none appearance-none transition-all"
                    >
                      <option value="">-- Aucun produit --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({new Intl.NumberFormat('fr-FR').format(p.purchase_price)} FCFA)</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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

              {/* Debt / Payment Status (Business Only) */}
              {currentProject?.type === 'continuous' && formData.type === 'income' && (
                <div className="space-y-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className={formData.payment_status === 'unpaid' ? 'text-orange-500' : 'text-muted-foreground'} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Vendre à crédit ?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, payment_status: formData.payment_status === 'paid' ? 'unpaid' : 'paid' })}
                      className={`w-10 h-5 rounded-full relative transition-colors ${formData.payment_status === 'unpaid' ? 'bg-orange-500' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.payment_status === 'unpaid' ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  {formData.payment_status === 'unpaid' && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-orange-500 ml-1">Client débiteur</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        <select
                          required={formData.payment_status === 'unpaid'}
                          value={formData.customer_id}
                          onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                          className="w-full bg-background border border-orange-500/30 rounded-xl py-2 pl-9 pr-4 text-xs focus:border-orange-500 outline-none appearance-none transition-all"
                        >
                          <option value="">-- Sélectionner un client --</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quantity & Town */}
              {(fields.quantity || fields.town) && (
                <div className={`grid ${fields.quantity && fields.town ? 'grid-cols-2' : 'grid-cols-1'} gap-3 p-3 rounded-2xl border transition-all duration-300 ${selectedCatName === 'Vente' ? 'bg-primary/5 border-primary/20 scale-[1.02]' : 'bg-transparent border-transparent'}`}>
                  {fields.quantity && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Quantité / Unités</label>
                        {selectedCatName === 'Vente' && <span className="text-[7px] font-black text-primary uppercase">Requis pour Vente</span>}
                      </div>
                      <div className="relative">
                        <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input
                          type="number"
                          step="any"
                          placeholder="1"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                          className="w-full bg-background border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:border-primary outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {fields.town && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Ville</label>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input
                          type="text"
                          placeholder="Ex: Douala"
                          value={formData.town}
                          onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                          className="w-full bg-background border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:border-primary outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* Removed Exclusion Toggle - Now handled automatically by category selection */}

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
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
