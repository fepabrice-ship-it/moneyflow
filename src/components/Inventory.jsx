import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Save,
  Loader2,
  Pencil,
  AlertTriangle,
  MapPin,
  Globe,
  ChevronDown,
  Boxes,
  History,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import InventoryEditModal from './InventoryEditModal';
import { normalizeCity } from '../lib/cityUtils';
import { createOpeningStockTransaction } from '../lib/stockUtils';
import { useRefreshTrigger } from '../hooks/useRefreshTrigger';

const Inventory = () => {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [newProduct, setNewProduct] = useState({ name: '', sku: '', purchase_price: '', stock_quantity: '', alert_threshold: 5 });
  const [editingProduct, setEditingProduct] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [cityFilter, setCityFilter] = useState('all');
  const [selectedInventoryEdit, setSelectedInventoryEdit] = useState(null);

  const isOwner = currentProject?.role === 'owner';

  const refreshTick = useRefreshTrigger();
  useEffect(() => {
    if (currentProject) fetchData();
  }, [currentProject, refreshTick]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, txRes] = await Promise.all([
        supabase.from('products').select('*').eq('project_id', currentProject.id).order('name'),
        supabase.from('transactions')
          .select('product_id, quantity, town, type, amount, categories(name)')
          .eq('project_id', currentProject.id)
      ]);
      if (prodRes.data) setProducts(prodRes.data);
      if (txRes.data) setTransactions(txRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewProduct({ name: '', sku: '', purchase_price: '', stock_quantity: '', alert_threshold: 5 });
    setEditingProduct(null);
    setShowProductForm(false);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !currentProject) return;
    setIsSaving(true);
    try {
      // products.stock_quantity n'est plus la source de vérité : on ne le touche
      // plus du tout. Le stock initial saisi à la création devient une vraie
      // transaction (exclude_from_global) pour rester cohérent avec la dérivation.
      const purchasePrice = parseFloat(newProduct.purchase_price) || 0;
      const payload = {
        name: newProduct.name,
        sku: newProduct.sku || null,
        purchase_price: purchasePrice,
        alert_threshold: parseFloat(newProduct.alert_threshold) || 5,
        project_id: currentProject.id,
      };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase.from('products').insert([payload]).select().single();
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
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const startEdit = (p) => {
    setEditingProduct(p);
    setNewProduct({
      name: p.name,
      sku: p.sku || '',
      purchase_price: p.purchase_price ?? '',
      stock_quantity: p.stock_quantity ?? '',
      alert_threshold: p.alert_threshold ?? 5
    });
    setShowProductForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Derive live stock from transactions (audit trail) ---
  // 'Vente' = stock out, 'Investissement'/'Achats produits' = stock in.
  const { movements, cities, totals } = useMemo(() => {
    const byKey = {}; // `${productId}|${city}` -> { stockIn, stockOut, balance }
    const citySet = new Set();
    transactions.forEach(tx => {
      if (!tx.product_id) return;
      const city = normalizeCity(tx.town);
      citySet.add(city);
      const key = `${tx.product_id}|${city}`;
      if (!byKey[key]) byKey[key] = { productId: tx.product_id, city, stockIn: 0, stockOut: 0 };
      const qty = Number(tx.quantity || 0);
      const catName = tx.categories?.name;
      if (catName === 'Vente') byKey[key].stockOut += qty;
      else if (catName === 'Investissement' || catName === 'Achats produits') byKey[key].stockIn += qty;
    });

    const rows = Object.values(byKey).map(r => ({
      ...r,
      balance: r.stockIn - r.stockOut,
      product: products.find(p => p.id === r.productId)?.name || 'Inconnu'
    }));

    const totalStockValue = products.reduce((acc, p) => {
      const bal = rows.filter(r => r.productId === p.id).reduce((s, r) => s + r.balance, 0);
      return acc + Math.max(bal, 0) * Number(p.purchase_price || 0);
    }, 0);

    const lowStock = products.filter(p => {
      const bal = rows.filter(r => r.productId === p.id).reduce((s, r) => s + r.balance, 0);
      return bal <= Number(p.alert_threshold ?? 5);
    });

    return {
      movements: rows.sort((a, b) => a.product.localeCompare(b.product)),
      cities: ['all', ...Array.from(citySet).sort()],
      totals: { totalStockValue, lowStockCount: lowStock.length, productCount: products.length }
    };
  }, [transactions, products]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  const filteredMovements = movements.filter(m => cityFilter === 'all' || m.city === cityFilter);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Produits</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-[10px] mt-1">Gérez vos produits et suivez les stocks</p>
      </header>

      {/* Summary KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex flex-col justify-between min-h-[110px]">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3"><Boxes size={16} className="text-primary" /></div>
          <div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Produits</p>
            <p className="text-lg font-black mt-1 text-white">{totals.productCount}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex flex-col justify-between min-h-[110px]">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-3"><Package size={16} className="text-green-500" /></div>
          <div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Valeur du Stock</p>
            <p className="text-lg font-black mt-1 text-green-500 truncate">{new Intl.NumberFormat('fr-FR').format(totals.totalStockValue)} F</p>
          </div>
        </div>
        <div className="glass-card p-4 flex flex-col justify-between min-h-[110px] col-span-2 lg:col-span-1">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3"><AlertTriangle size={16} className="text-orange-500" /></div>
          <div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Stock Bas</p>
            <p className={`text-lg font-black mt-1 ${totals.lowStockCount > 0 ? 'text-orange-500' : 'text-white'}`}>{totals.lowStockCount}</p>
          </div>
        </div>
      </section>

      {/* Product Management */}
      <section className="glass-card p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="text-primary" size={20} />
            <h2 className="font-bold">{editingProduct ? 'Modifier le Produit' : 'Mes Produits'}</h2>
          </div>
          {isOwner && !showProductForm && (
            <button
              onClick={() => setShowProductForm(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 h-10 rounded-xl text-[11px] font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={16} /> Nouveau produit
            </button>
          )}
          {isOwner && showProductForm && (
            <button
              onClick={resetForm}
              className="text-[10px] font-bold text-muted-foreground hover:text-white uppercase tracking-widest transition-colors"
            >
              Annuler
            </button>
          )}
        </div>

        {isOwner && showProductForm && (
          <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white/5 rounded-2xl border border-primary/20 animate-in fade-in zoom-in-95 duration-200">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nom du Produit</label>
              <input
                required type="text" value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="w-full bg-background border border-white/10 rounded-xl py-2 px-4 text-sm outline-none focus:border-primary transition-all"
                placeholder="Ex: Sac de Riz 25kg"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">SKU (Optionnel)</label>
              <input
                type="text" value={newProduct.sku}
                onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                className="w-full bg-background border border-white/10 rounded-xl py-2 px-4 text-sm outline-none focus:border-primary transition-all"
                placeholder="Réf."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Prix d'Achat (FCFA)</label>
              <input
                type="number" value={newProduct.purchase_price}
                onChange={(e) => setNewProduct({ ...newProduct, purchase_price: e.target.value })}
                className="w-full bg-background border border-white/10 rounded-xl py-2 px-4 text-sm outline-none focus:border-primary transition-all"
                placeholder="0"
              />
            </div>
            {!editingProduct && (
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Stock Initial</label>
                <input
                  type="number" value={newProduct.stock_quantity}
                  onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-xl py-2 px-4 text-sm outline-none focus:border-primary transition-all"
                  placeholder="0"
                />
                <p className="text-[9px] text-muted-foreground italic ml-1">Crée une transaction "Stock initial" pour matérialiser ce solde d'ouverture.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Seuil d'Alerte</label>
              <input
                type="number" value={newProduct.alert_threshold}
                onChange={(e) => setNewProduct({ ...newProduct, alert_threshold: e.target.value })}
                className="w-full bg-background border border-white/10 rounded-xl py-2 px-4 text-sm outline-none focus:border-primary transition-all"
                placeholder="5"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit" disabled={isSaving}
                className="w-full bg-primary text-white h-11 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : (editingProduct ? <><Save size={16} /> Enregistrer</> : <><Plus size={16} /> Ajouter le Produit</>)}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
          {products.map(p => {
            const balance = movements.filter(m => m.productId === p.id).reduce((s, m) => s + m.balance, 0);
            const isLow = balance <= Number(p.alert_threshold ?? 5);
            return (
              <div key={p.id} className="bg-background border border-white/5 rounded-2xl overflow-hidden">
                {/* Détails */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isLow ? 'bg-orange-500/10 text-orange-500' : 'bg-primary/10 text-primary'}`}>
                      <Package size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                        {p.sku || 'Sans SKU'} • {new Intl.NumberFormat('fr-FR').format(p.purchase_price || 0)} FCFA/u
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black ${isLow ? 'text-orange-500' : 'text-green-500'}`}>{balance} en stock</p>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-tighter">Alerte à {p.alert_threshold ?? 5}</p>
                  </div>
                </div>

                {/* Actions */}
                {isOwner && (
                  <div className="grid grid-cols-2 border-t border-white/5">
                    <button
                      onClick={() => startEdit(p)}
                      className="flex items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Pencil size={14} /> Modifier
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="flex items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/5 transition-colors border-l border-white/5"
                    >
                      <Trash2 size={14} /> Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {products.length === 0 && (
            <div className="text-center py-10 space-y-3">
              <p className="text-xs text-muted-foreground italic">Aucun produit configuré.</p>
              {isOwner && !showProductForm && (
                <button
                  onClick={() => setShowProductForm(true)}
                  className="inline-flex items-center gap-2 bg-primary text-white px-4 h-10 rounded-xl text-[11px] font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
                >
                  <Plus size={16} /> Créer mon premier produit
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Stock Movements / Audit */}
      <section className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-2">
            <History className="text-primary" size={20} />
            <div>
              <h2 className="font-bold">Mouvements de Stock</h2>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Cliquez une ligne pour voir qui a ajouté ou retiré du stock</p>
            </div>
          </div>
          <div className="relative min-w-[180px]">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={14} />
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-xl py-2 pl-9 pr-8 text-xs font-bold uppercase tracking-wider outline-none focus:border-primary appearance-none transition-all"
            >
              <option value="all">Toutes les villes</option>
              {cities.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5">
                <th className="py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest min-w-[120px]">Produit</th>
                <th className="py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest min-w-[100px]">Ville</th>
                <th className="py-3 text-right text-[10px] font-black uppercase text-green-500 tracking-widest">Entrées</th>
                <th className="py-3 text-right text-[10px] font-black uppercase text-orange-500 tracking-widest">Sorties</th>
                <th className="py-3 text-right text-[10px] font-black uppercase text-white tracking-widest">Reste</th>
                <th className="py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((m, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedInventoryEdit({ id: m.productId, name: m.product, city: m.city })}
                  className="border-b border-white/5 group hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <td className="py-4 text-xs font-black">{m.product}</td>
                  <td className="py-4 text-[10px] font-bold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><MapPin size={10} className="text-primary/60" />{m.city}</span>
                  </td>
                  <td className="py-4 text-right text-xs font-bold text-green-500/80">
                    <span className="inline-flex items-center gap-1"><ArrowDownLeft size={12} />{m.stockIn}</span>
                  </td>
                  <td className="py-4 text-right text-xs font-bold text-orange-500/80">
                    <span className="inline-flex items-center gap-1"><ArrowUpRight size={12} />{m.stockOut}</span>
                  </td>
                  <td className="py-4 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-black ${m.balance > 5 ? 'text-white' : m.balance > 0 ? 'text-yellow-500 bg-yellow-500/5' : 'text-red-500 bg-red-500/5'}`}>
                      {m.balance}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <Pencil size={14} className="text-muted-foreground group-hover:text-primary transition-colors inline" />
                  </td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr><td colSpan="6" className="py-10 text-center text-muted-foreground italic text-sm">Aucun mouvement de stock détecté.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <InventoryEditModal
        isOpen={!!selectedInventoryEdit}
        onClose={() => setSelectedInventoryEdit(null)}
        product={selectedInventoryEdit ? { id: selectedInventoryEdit.id, name: selectedInventoryEdit.name } : null}
        city={selectedInventoryEdit?.city}
        onRefresh={fetchData}
      />
    </div>
  );
};

export default Inventory;
