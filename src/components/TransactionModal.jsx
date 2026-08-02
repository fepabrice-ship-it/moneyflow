import React, { useState, useEffect } from 'react';
import { X, Loader2, Receipt, Calendar, Tag, Check, AlertCircle, Package, User, Plus, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { logActivity, summarizeTransaction } from '../lib/audit';
import { showToast } from '../lib/toast';

// Tuiles de saisie rapide : chaque tuile pré-remplit type + catégorie avec des
// mots du quotidien. Objectif : 2 gestes (tuile → montant) pour enregistrer,
// tout le reste est optionnel derrière « Plus de détails ».
const QUICK_ACTIONS_BUSINESS = [
  { key: 'vente',     emoji: '🛒', label: "J'ai vendu",        type: 'income',  category: 'Vente' },
  { key: 'stock',     emoji: '📦', label: 'Achat de stock',    type: 'expense', category: 'Achats produits' },
  { key: 'depense',   emoji: '💸', label: "J'ai dépensé",      type: 'expense', category: null },
  { key: 'recu',      emoji: '💰', label: 'Argent reçu',       type: 'income',  category: null },
  { key: 'prete',     emoji: '🤝', label: "J'ai prêté",        type: 'expense', category: 'Prêt accordé' },
  { key: 'rembourse', emoji: '🔁', label: "On m'a remboursé",  type: 'income',  category: 'Remboursement de prêt' },
];
const QUICK_ACTIONS_PERSONAL = [
  { key: 'depense',   emoji: '💸', label: "J'ai dépensé",           type: 'expense', category: null },
  { key: 'recu',      emoji: '💰', label: "J'ai reçu de l'argent",  type: 'income',  category: null },
  { key: 'prete',     emoji: '🤝', label: "J'ai prêté",             type: 'expense', category: 'Prêt accordé' },
  { key: 'rembourse', emoji: '🔁', label: "On m'a remboursé",       type: 'income',  category: 'Remboursement de prêt' },
];

const TransactionModal = ({ isOpen, onClose, onRefresh, editingTransaction = null, initialData = null }) => {
  const { currentProject, members } = useProject();
  const isBusiness = currentProject?.type === 'continuous';
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
  const [townSuggestions, setTownSuggestions] = useState([]);

  // Saisie rapide
  const [action, setAction] = useState(null); // clé de la tuile sélectionnée
  const [showDetails, setShowDetails] = useState(false);

  // Création de client sans quitter le formulaire
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  const quickActions = isBusiness ? QUICK_ACTIONS_BUSINESS : QUICK_ACTIONS_PERSONAL;

  useEffect(() => {
    if (isOpen) {
      setShowDetails(!!editingTransaction);
      setAction(null);
      setShowNewCustomer(false);
      setNewCustomerName('');
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
      fetchTowns();
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

  // Villes déjà utilisées dans le projet → suggestions en un tap (évite les
  // fautes de frappe qui éclatent les stats par ville).
  const fetchTowns = async () => {
    if (!currentProject) return;
    const { data } = await supabase.from('transactions')
      .select('town')
      .eq('project_id', currentProject.id)
      .not('town', 'is', null);
    const counts = {};
    (data || []).forEach(({ town }) => {
      const label = (town || '').trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (!counts[key]) counts[key] = { n: 0, label };
      counts[key].n++;
    });
    setTownSuggestions(Object.values(counts).sort((a, b) => b.n - a.n).slice(0, 6).map(c => c.label));
  };

  const BUSINESS_CATEGORIES = ['Vente', 'Achats produits', 'Frais de livraison', 'Loyer', 'Electricité', 'Achats divers', 'Salaire', 'Investissement', 'Expédition', 'Transport produits', 'Publicité', 'Prêt accordé', 'Remboursement de prêt'];

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
        setFormData(prev => ({ ...prev, category_id: prev.category_id || filtered[0].id }));
      }
    }
  };

  // Sélection d'une tuile : pré-remplit type + catégorie.
  const selectAction = (a) => {
    setAction(a.key);
    setFormData(prev => {
      const next = { ...prev, type: a.type };
      if (a.type === 'expense') {
        next.payment_status = 'paid';
        next.customer_id = '';
      }
      if (a.category) {
        const cat = categories.find(c => c.name === a.category);
        if (cat) next.category_id = cat.id;
      }
      return next;
    });
  };

  // La tuile "dépense"/"reçu" laisse le choix de la catégorie : on ne propose
  // que celles du bon type de flux pour ne pas noyer l'utilisateur. Les
  // catégories de prêt ont leurs propres tuiles, on les écarte d'ici.
  const INCOME_CATEGORIES = new Set(['Vente', 'Salaire', 'Investissement']);
  const LOAN_CATEGORIES = new Set(['Prêt accordé', 'Remboursement de prêt']);
  const categoryChoices = (action === 'depense')
    ? categories.filter(c => !['Vente'].includes(c.name) && !LOAN_CATEGORIES.has(c.name))
    : (action === 'recu')
      ? categories.filter(c => (INCOME_CATEGORIES.has(c.name) || !isBusiness) && !LOAN_CATEGORIES.has(c.name))
      : categories;

  const formatAmount = (raw) => raw ? new Intl.NumberFormat('fr-FR').format(Number(raw)) : '';

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    setFormData({ ...formData, amount: raw });
  };

  const handleAddCustomer = async () => {
    const name = newCustomerName.trim();
    if (!name || !currentProject) return;
    setSavingCustomer(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ name, project_id: currentProject.id }])
        .select()
        .single();
      if (error) throw error;
      setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData(prev => ({ ...prev, customer_id: data.id }));
      setShowNewCustomer(false);
      setNewCustomerName('');
      showToast(`Client « ${name} » ajouté ✓`);
    } catch (err) {
      showToast("Impossible d'ajouter le client. Réessaie.", 'error');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentProject) return;
    if (!formData.amount || Number(formData.amount) <= 0) {
      showToast('Entre le montant avant de valider.', 'error');
      return;
    }
    setLoading(true);

    try {
      // Description optionnelle : on génère un libellé simple si vide.
      const catName = categories.find(c => c.id === formData.category_id)?.name;
      const autoLabel = `${catName || (formData.type === 'income' ? 'Revenu' : 'Dépense')} du ${new Date(formData.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;

      const payload = {
        ...formData,
        description: formData.description.trim() || autoLabel,
        amount: parseFloat(formData.amount),
        quantity: parseFloat(formData.quantity) || 1,
        product_id: formData.product_id === '' ? null : formData.product_id,
        customer_id: formData.customer_id === '' ? null : formData.customer_id,
        // Un prêt rattaché à une personne = dette à récupérer → il apparaît
        // dans l'Ardoise tant qu'il n'est pas remboursé.
        payment_status: (action === 'prete' && formData.customer_id) ? 'unpaid' : formData.payment_status,
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

      // Remboursement rattaché à une personne : on solde ses prêts en attente,
      // du plus ancien au plus récent, tant que le montant remboursé couvre le
      // prêt en entier (pas de règlement partiel d'une même ligne).
      if (!editingTransaction && action === 'rembourse' && formData.customer_id) {
        const { data: loans } = await supabase.from('transactions')
          .select('id, amount')
          .eq('project_id', currentProject.id)
          .eq('customer_id', formData.customer_id)
          .eq('payment_status', 'unpaid')
          .eq('type', 'expense')
          .order('date', { ascending: true });
        let remaining = parseFloat(formData.amount);
        const settled = [];
        for (const loan of loans || []) {
          if (Number(loan.amount) <= remaining + 0.001) {
            settled.push(loan.id);
            remaining -= Number(loan.amount);
          }
        }
        if (settled.length > 0) {
          await supabase.from('transactions').update({ payment_status: 'paid' }).in('id', settled);
        }
      }

      // Feedback visible : la confiance vient de la confirmation.
      showToast(
        editingTransaction
          ? 'Modification enregistrée ✓'
          : `${catName || 'Opération'} de ${formatAmount(payload.amount)} F enregistrée ✓`
      );

      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      showToast("L'enregistrement a échoué. Vérifie ta connexion et réessaie.", 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const showProductRow = isBusiness && (action === 'vente' || action === 'stock') && !showDetails;
  const showCategoryPicker = editingTransaction || showDetails || action === 'depense' || action === 'recu';

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={onClose} />

      {/* Drawer/Modal */}
      <div className="relative w-full max-w-lg bg-muted border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-300 max-h-[92vh] flex flex-col">
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-4 mb-2 shrink-0" />

        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-muted shrink-0">
          <h2 className="text-lg font-bold">{editingTransaction ? 'Modifier' : 'Nouvelle opération'}</h2>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* Tuiles d'action (création) ou toggle type (édition) */}
          {!editingTransaction ? (
            <div className={`grid gap-2 ${quickActions.length > 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {quickActions.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => selectAction(a)}
                  className={`flex flex-col items-center justify-center gap-1 py-4 rounded-2xl border transition-all ${
                    action === a.key
                      ? 'bg-primary/10 border-primary scale-[1.02] shadow-lg shadow-primary/10'
                      : 'bg-background border-white/5 active:scale-95'
                  }`}
                >
                  <span className="text-2xl">{a.emoji}</span>
                  <span className={`text-xs font-bold ${action === a.key ? 'text-primary' : 'text-foreground'}`}>{a.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex p-1 bg-background rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${formData.type === 'expense' ? 'bg-red-500 text-primary-foreground shadow-lg' : 'text-muted-foreground'}`}
              >
                Dépense
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${formData.type === 'income' ? 'bg-green-500 text-primary-foreground shadow-lg' : 'text-muted-foreground'}`}
              >
                Revenu
              </button>
            </div>
          )}

          {/* Montant — le champ central, gros, clavier numérique */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground ml-1">Montant (FCFA)</label>
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="0"
              value={formatAmount(formData.amount)}
              onChange={handleAmountChange}
              className="w-full bg-background border border-white/5 rounded-2xl py-4 px-5 text-3xl font-black text-center focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Vente / Achat de stock : produit + quantité tout de suite (stock) */}
          {showProductRow && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/20">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground ml-1">Produit</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-xl py-2.5 px-3 text-xs focus:border-primary outline-none appearance-none transition-all"
                >
                  <option value="">Aucun produit</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground ml-1">Quantité</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-xl py-2.5 px-3 text-xs focus:border-primary outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Catégorie : visible quand la tuile ne l'impose pas, ou en mode détaillé */}
          {showCategoryPicker && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground ml-1">Catégorie</label>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:border-primary outline-none appearance-none transition-all"
                >
                  {(editingTransaction || showDetails ? categories : categoryChoices).map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Prêt d'argent : suivi de qui doit quoi via l'Ardoise (business) */}
          {isBusiness && (action === 'prete' || action === 'rembourse') && !editingTransaction && (
            <div className="space-y-2 p-3 bg-white/5 rounded-2xl border border-white/5">
              <label className="text-xs font-bold text-muted-foreground ml-1">
                {action === 'prete' ? 'À qui as-tu prêté ? (pour suivre la dette)' : "Qui t'a remboursé ?"}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full bg-background border border-white/5 rounded-xl py-2 pl-9 pr-4 text-sm focus:border-primary outline-none appearance-none transition-all"
                >
                  <option value="">Sans suivi (juste noter l'argent)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {!showNewCustomer ? (
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-80 transition-opacity ml-1"
                >
                  <Plus size={14} /> Nouvelle personne
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Son nom"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomer(); } }}
                    className="flex-1 bg-background border border-white/10 rounded-xl py-2 px-3 text-sm focus:border-primary outline-none transition-all"
                  />
                  <button
                    type="button"
                    disabled={savingCustomer || !newCustomerName.trim()}
                    onClick={handleAddCustomer}
                    className="px-4 bg-primary text-primary-foreground rounded-xl text-xs font-bold disabled:opacity-40 transition-all"
                  >
                    {savingCustomer ? <Loader2 className="animate-spin" size={14} /> : 'Ajouter'}
                  </button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground leading-snug ml-1">
                {action === 'prete'
                  ? "Le prêt compte comme une dépense tant qu'il n'est pas remboursé, et la personne apparaît dans l'Ardoise."
                  : 'Le remboursement rebouche la dépense du prêt — il ne compte pas comme un revenu.'}
              </p>
            </div>
          )}

          {/* Vente à crédit (Business, revenus) */}
          {isBusiness && formData.type === 'income' && action !== 'rembourse' && (
            <div className="space-y-3 p-3 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className={formData.payment_status === 'unpaid' ? 'text-orange-500' : 'text-muted-foreground'} />
                  <span className="text-xs font-bold">Vendre à crédit ?</span>
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
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-orange-500 ml-1">Qui te doit cet argent ?</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <select
                      required={formData.payment_status === 'unpaid' && !showNewCustomer}
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="w-full bg-background border border-orange-500/30 rounded-xl py-2 pl-9 pr-4 text-sm focus:border-orange-500 outline-none appearance-none transition-all"
                    >
                      <option value="">Choisis un client…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Nouveau client sans quitter le formulaire */}
                  {!showNewCustomer ? (
                    <button
                      type="button"
                      onClick={() => setShowNewCustomer(true)}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-80 transition-opacity ml-1"
                    >
                      <Plus size={14} /> Nouveau client
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Nom du client"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomer(); } }}
                        className="flex-1 bg-background border border-white/10 rounded-xl py-2 px-3 text-sm focus:border-primary outline-none transition-all"
                      />
                      <button
                        type="button"
                        disabled={savingCustomer || !newCustomerName.trim()}
                        onClick={handleAddCustomer}
                        className="px-4 bg-primary text-primary-foreground rounded-xl text-xs font-bold disabled:opacity-40 transition-all"
                      >
                        {savingCustomer ? <Loader2 className="animate-spin" size={14} /> : 'Ajouter'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Plus de détails (repliés par défaut en création) */}
          {!editingTransaction && (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetails ? 'Masquer les détails' : 'Plus de détails (description, date, ville…)'}
              <ChevronDown size={14} className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>
          )}

          {(showDetails || editingTransaction) && (
            <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
              {/* Description (optionnelle : libellé auto sinon) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground ml-1">Description (optionnel)</label>
                <div className="relative">
                  <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="text"
                    placeholder="Ex: Vente cliente marché"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-background border border-white/5 rounded-xl py-2.5 pl-12 pr-4 text-sm focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>

              {/* Produit / Quantité (si pas déjà affichés et pertinents) */}
              {!showProductRow && fields.product && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Produit</label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                      <select
                        value={formData.product_id}
                        onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                        className="w-full bg-background border border-white/5 rounded-xl py-2.5 pl-9 pr-3 text-xs focus:border-primary outline-none appearance-none transition-all"
                      >
                        <option value="">Aucun</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {fields.quantity && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground ml-1">Quantité</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className="w-full bg-background border border-white/5 rounded-xl py-2.5 px-3 text-xs focus:border-primary outline-none transition-all"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Ville avec suggestions (évite les fautes de frappe) */}
              {(fields.town || showDetails) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground ml-1">Ville</label>
                  {townSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {townSuggestions.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormData({ ...formData, town: t })}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            formData.town.trim().toLowerCase() === t.toLowerCase()
                              ? 'bg-primary/15 border-primary text-primary'
                              : 'bg-white/5 border-white/5 text-muted-foreground'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Autre ville…"
                    value={formData.town}
                    onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                    className="w-full bg-background border border-white/5 rounded-xl py-2.5 px-4 text-sm focus:border-primary outline-none transition-all"
                  />
                </div>
              )}

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground ml-1">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-background border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>

              {/* Responsable */}
              {members.length > 1 && (
                <div className="border-t border-white/5 pt-3">
                  <label className="text-xs font-bold text-primary ml-1 block mb-2">Qui a fait cette opération ?</label>
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
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-muted-foreground'
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
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!editingTransaction && !action)}
            className="w-full bg-primary text-primary-foreground h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-primary/20 cursor-pointer"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <Check size={20} />
                {editingTransaction ? 'Enregistrer' : 'Valider'}
              </>
            )}
          </button>
          {!editingTransaction && !action && (
            <p className="text-center text-xs text-muted-foreground -mt-2">Choisis d'abord une action en haut 👆</p>
          )}
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
