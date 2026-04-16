import React, { useState, useEffect } from 'react';
import { X, Save, Globe, Package, Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';

const BulkEditModal = ({ isOpen, onClose, selectedIds, onRefresh }) => {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  
  const [updateFields, setUpdateFields] = useState({
    town: false,
    product: false
  });

  const [formData, setFormData] = useState({
    town: '',
    product_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    if (!currentProject) return;
    const { data } = await supabase.from('products').select('*').eq('project_id', currentProject.id).order('name');
    if (data) setProducts(data);
  };

  const handleBulkUpdate = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    
    const updates = {};
    if (updateFields.town) updates.town = formData.town;
    if (updateFields.product) updates.product_id = formData.product_id === '' ? null : formData.product_id;

    if (Object.keys(updates).length === 0) {
      alert('Veuillez sélectionner au moins un champ à modifier.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update(updates)
        .in('id', selectedIds);

      if (error) throw error;
      
      onRefresh();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-muted border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-muted">
          <div>
            <h2 className="text-lg font-bold">Modification en masse</h2>
            <p className="text-[10px] text-primary font-black uppercase tracking-widest">{selectedIds.length} Transactions sélectionnées</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleBulkUpdate} className="p-6 space-y-6">
          <div className="space-y-4">
            {/* Town Field */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${updateFields.town ? 'bg-primary border-primary' : 'bg-transparent border-white/20'}`}>
                    {updateFields.town && <Check size={14} className="text-white" />}
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={updateFields.town}
                      onChange={() => setUpdateFields({...updateFields, town: !updateFields.town})}
                    />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-white group-hover:text-primary transition-colors">Modifier la Ville</span>
                </div>
                <Globe size={16} className="text-muted-foreground" />
              </label>

              {updateFields.town && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <input
                    type="text"
                    placeholder="Nouvelle ville (ex: Douala)"
                    className="w-full bg-background border border-white/10 rounded-xl py-2.5 px-4 text-sm focus:border-primary outline-none transition-all"
                    value={formData.town}
                    onChange={(e) => setFormData({...formData, town: e.target.value})}
                  />
                </div>
              )}
            </div>

            {/* Product Field */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${updateFields.product ? 'bg-primary border-primary' : 'bg-transparent border-white/20'}`}>
                    {updateFields.product && <Check size={14} className="text-white" />}
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={updateFields.product}
                      onChange={() => setUpdateFields({...updateFields, product: !updateFields.product})}
                    />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-white group-hover:text-primary transition-colors">Modifier le Produit</span>
                </div>
                <Package size={16} className="text-muted-foreground" />
              </label>

              {updateFields.product && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <select
                    className="w-full bg-background border border-white/10 rounded-xl py-2.5 px-4 text-sm focus:border-primary outline-none transition-all"
                    value={formData.product_id}
                    onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                  >
                    <option value="">-- Aucun produit --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-2xl">
            <AlertCircle className="text-primary shrink-0" size={16} />
            <p className="text-[10px] text-muted-foreground leading-tight italic">
              Cette action écrasera les valeurs existantes pour les {selectedIds.length} transactions sélectionnées par les nouvelles valeurs définies ci-dessus.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || (!updateFields.town && !updateFields.product)}
            className="w-full bg-primary text-white h-12 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <Save size={16} />
                Mettre à jour {selectedIds.length} éléments
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BulkEditModal;
