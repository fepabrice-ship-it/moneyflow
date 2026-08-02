import { computeAllProductStocks } from './stockUtils';

// Source unique de vérité pour les chiffres clés d'un projet.
// Toutes les vues (Dashboard, Transactions, Statistiques) doivent passer par
// ici pour que les mêmes définitions produisent les mêmes montants partout.
//
// Définitions :
//   - Argent disponible (trésorerie) : tout ce qui est entré − tout ce qui est
//     sorti, capital compris. C'est ce qu'il y a réellement en caisse.
//   - Revenus / Dépenses (performance) : hors apports de capital et hors
//     transactions marquées internes (exclude_from_global).
//   - Bénéfice : revenus − coût des marchandises VENDUES (COGS) − charges
//     d'exploitation. Un achat de stock n'est pas une perte : il ne devient
//     un coût qu'au moment où la marchandise est vendue.
//   - Valeur du stock : quantités restantes × coût unitaire d'achat.
//   - Reste du capital : argent disponible + valeur du stock. C'est ce qu'il
//     reste concrètement du capital investi (en cash et en marchandise), et
//     c'est cohérent avec « capital investi + bénéfice ». L'ancienne formule
//     (capital − toutes les dépenses) ignorait que les dépenses sont aussi
//     financées par les ventes et devenait négative sans signification.

const STOCK_IN_CATEGORIES = new Set(['Achats produits', 'Investissement']);
const CAPITAL_CATEGORY_NAMES = new Set(['Investissement', 'Capital']);

// Logique des prêts d'argent (principe de prudence) :
//   - « Prêt accordé » = une VRAIE dépense : rien ne garantit le remboursement,
//     la caisse a un trou. Compté dans Total dépenses et le bénéfice.
//   - « Remboursement de prêt » = PAS un revenu : il ANNULE la dépense du prêt
//     (il vient en déduction des dépenses). Jamais remboursé → la perte reste ;
//     remboursé → l'opération devient neutre. Les revenus ne sont jamais gonflés.
export const LOAN_REPAYMENT_CATEGORY = 'Remboursement de prêt';

// Catégories « cash uniquement » côté revenus : font bouger l'argent
// disponible mais ne sont pas des gains (Capital = apport ; le remboursement
// de prêt est traité à part, en déduction des dépenses).
export const CASH_ONLY_CATEGORIES = new Set(['Capital', LOAN_REPAYMENT_CATEGORY]);

// Une transaction compte dans la performance (revenus/dépenses/bénéfice)
// sauf si elle est marquée interne ou dans une catégorie « cash uniquement ».
export const isPerformanceTx = (tx) =>
  tx.exclude_from_global !== true && !CASH_ONLY_CATEGORIES.has(tx.categories?.name);

// Apport de capital : entrée d'argent "Investissement"/"Capital" ou marquée
// interne (ex. « Capital de départ »).
export const isCapitalContribution = (tx) =>
  tx.type === 'income' &&
  (CAPITAL_CATEGORY_NAMES.has(tx.categories?.name) || tx.exclude_from_global === true);

// Coût unitaire réel par produit, dérivé de toutes les entrées de stock du
// projet (plus fiable que products.purchase_price, prix de référence figé).
// productPriceMap sert de repli quand un produit n'a aucune entrée de stock.
export const buildUnitCostResolver = (allTransactions, productPriceMap = {}) => {
  const acquisition = {}; // product_id -> { qty, amount }
  for (const tx of allTransactions) {
    if (tx.type !== 'expense' || !tx.product_id) continue;
    if (!STOCK_IN_CATEGORIES.has(tx.categories?.name)) continue;
    const q = Number(tx.quantity || 0);
    if (q <= 0) continue;
    if (!acquisition[tx.product_id]) acquisition[tx.product_id] = { qty: 0, amount: 0 };
    acquisition[tx.product_id].qty += q;
    acquisition[tx.product_id].amount += Number(tx.amount || 0);
  }
  return (productId) => {
    const a = acquisition[productId];
    if (a && a.qty > 0) return a.amount / a.qty;
    return Number(productPriceMap[productId] || 0);
  };
};

// Calcule tous les chiffres clés d'un projet.
//   transactions      : transactions à agréger (éventuellement filtrées par membre)
//   allTransactions   : toutes les transactions du projet — sert au coût unitaire,
//                       au stock et au capital, qui ne dépendent pas du filtre
//                       membre (défaut : transactions)
//   productPriceMap   : { product_id: purchase_price } en repli du coût empirique
//   periodStart/End   : bornes 'YYYY-MM-DD' de la période « mensuelle »
export const computeProjectStats = (
  transactions,
  { allTransactions = transactions, productPriceMap = {}, periodStart = null, periodEnd = null } = {}
) => {
  const unitCostFor = buildUnitCostResolver(allTransactions, productPriceMap);

  // 1. Cash-flow (ce qu'il y a en poche : TOUT compte)
  let cashIncome = 0, cashSpent = 0;
  let cashMonthlyIncome = 0, cashMonthlySpent = 0;
  let cashPastIncome = 0, cashPastSpent = 0;

  // 2. Performance (ce qu'on a GAGNÉ : hors capital/interne)
  let perfIncome = 0, perfSpent = 0;
  let perfMonthlyIncome = 0, perfMonthlySpent = 0;

  // 3. Bénéfice (comptabilité d'engagement)
  let cogs = 0, cogsMonthly = 0;
  let opex = 0, opexMonthly = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    const isIncome = tx.type === 'income';
    const catName = tx.categories?.name;
    const inPeriod = periodStart && tx.date >= periodStart && (!periodEnd || tx.date <= periodEnd);
    const isPast = periodStart && tx.date < periodStart;

    if (isIncome) {
      cashIncome += amount;
      if (inPeriod) cashMonthlyIncome += amount;
      else if (isPast) cashPastIncome += amount;
    } else {
      cashSpent += amount;
      if (inPeriod) cashMonthlySpent += amount;
      else if (isPast) cashPastSpent += amount;
    }

    // Remboursement de prêt : vient en DÉDUCTION des dépenses (il rebouche le
    // trou creusé par « Prêt accordé »), jamais en ajout aux revenus.
    if (isIncome && catName === LOAN_REPAYMENT_CATEGORY && tx.exclude_from_global !== true) {
      perfSpent -= amount;
      opex -= amount;
      if (inPeriod) { perfMonthlySpent -= amount; opexMonthly -= amount; }
      continue;
    }

    if (!isPerformanceTx(tx)) continue;

    if (isIncome) {
      perfIncome += amount;
      if (inPeriod) perfMonthlyIncome += amount;
      // COGS : coût des marchandises effectivement vendues sur cette ligne.
      if (catName === 'Vente' && tx.product_id) {
        const lineCogs = (Number(tx.quantity) || 0) * unitCostFor(tx.product_id);
        cogs += lineCogs;
        if (inPeriod) cogsMonthly += lineCogs;
      }
    } else {
      perfSpent += amount;
      if (inPeriod) perfMonthlySpent += amount;
      // Charges d'exploitation = dépenses hors acquisition de stock.
      if (!STOCK_IN_CATEGORIES.has(catName)) {
        opex += amount;
        if (inPeriod) opexMonthly += amount;
      }
    }
  }

  // Capital et stock : propriétés du projet entier, jamais filtrées par membre.
  let capitalInvested = 0;
  for (const tx of allTransactions) {
    if (isCapitalContribution(tx)) capitalInvested += Number(tx.amount);
  }

  const stockMap = computeAllProductStocks(allTransactions);
  let stockValue = 0;
  for (const [productId, qty] of Object.entries(stockMap)) {
    if (qty > 0) stockValue += qty * unitCostFor(productId);
  }

  const available = cashIncome - cashSpent;
  const capitalRemaining = available + stockValue;

  return {
    // Cash-flow
    available,
    carryOver: cashPastIncome - cashPastSpent,
    cashIncome, cashSpent,
    cashMonthlyIncome, cashMonthlySpent,
    // Performance
    perfIncome, perfSpent,
    perfMonthlyIncome, perfMonthlySpent,
    // Bénéfice
    profit: perfIncome - cogs - opex,
    monthlyProfit: perfMonthlyIncome - cogsMonthly - opexMonthly,
    cogs, opex,
    // Patrimoine
    capitalInvested,
    stockValue,
    capitalRemaining,
  };
};
