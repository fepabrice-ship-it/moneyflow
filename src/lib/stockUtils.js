import { supabase } from './supabase';

// Source unique de vérité du stock : on dérive toujours depuis les transactions.
// Conventions (cohérentes avec Statistics / Inventory / AntiVol) :
//   - Catégorie "Vente"                          → sortie de stock (qty négative)
//   - Catégorie "Achats produits" / "Investissement" → entrée de stock
//
// Les transactions doivent inclure { product_id, quantity, categories: { name } }.

const STOCK_OUT = new Set(['Vente']);
const STOCK_IN = new Set(['Achats produits', 'Investissement']);

// Map product_id -> balance courante.
export const computeAllProductStocks = (transactions = []) => {
  const map = {};
  for (const tx of transactions) {
    if (!tx.product_id) continue;
    const catName = tx.categories?.name;
    const qty = Number(tx.quantity || 0);
    if (map[tx.product_id] == null) map[tx.product_id] = 0;
    if (STOCK_OUT.has(catName)) map[tx.product_id] -= qty;
    else if (STOCK_IN.has(catName)) map[tx.product_id] += qty;
  }
  return map;
};

// Balance pour un produit unique.
export const computeProductStock = (transactions, productId) => {
  return computeAllProductStocks(transactions)[productId] || 0;
};

// Crée une transaction "Stock initial" pour matérialiser un solde d'ouverture
// lors de la création d'un nouveau produit. Marquée exclude_from_global pour
// ne pas polluer le cash-flow / performance (c'est juste de l'inventaire qui
// existait déjà).
export const createOpeningStockTransaction = async ({ projectId, userId, productId, qty, unitCost }) => {
  const q = Number(qty) || 0;
  if (q <= 0 || !projectId || !userId || !productId) return;
  const { data: cat } = await supabase.from('categories').select('id').eq('name', 'Achats produits').maybeSingle();
  if (!cat) return;
  await supabase.from('transactions').insert([{
    project_id: projectId,
    user_id: userId,
    product_id: productId,
    category_id: cat.id,
    type: 'expense',
    amount: q * Number(unitCost || 0),
    quantity: q,
    description: 'Stock initial',
    town: 'Inconnu',
    exclude_from_global: true,
    payment_status: 'paid',
    date: new Date().toISOString().slice(0, 10),
  }]);
};
