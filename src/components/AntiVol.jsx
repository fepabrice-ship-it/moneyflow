import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ClipboardCheck,
  AlertTriangle,
  ScrollText,
  Loader2,
  Plus,
  Save,
  X,
  History,
  TrendingDown,
  PackageX,
  UserX,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Trash2,
  Crown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { normalizeCity } from '../lib/cityUtils';

const SECTIONS = [
  { id: 'comptage', label: 'Comptage physique', icon: ClipboardCheck },
  { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
  { id: 'journal', label: "Journal d'activité", icon: ScrollText },
];

const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0));

const AntiVol = ({ onClose }) => {
  const { currentProject, members } = useProject();
  const [section, setSection] = useState('comptage');

  // Owner-only: garde-fou côté UI (RLS le bloquerait de toute façon en lecture du journal)
  const isOwner = currentProject?.role === 'owner';

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <Header onClose={onClose} />
        <div className="glass-card p-8 text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Crown size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Espace réservé au propriétaire</h3>
            <p className="text-sm text-muted-foreground max-w-md">Les outils anti-vol sont réservés au propriétaire du projet pour préserver l'intégrité des investigations.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <Header onClose={onClose} />

      {/* Navigation interne */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-2 px-4 h-11 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              section === s.id
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-white/5 text-muted-foreground hover:text-white border border-white/5'
            }`}
          >
            <s.icon size={14} />
            {s.label}
          </button>
        ))}
      </div>

      {section === 'comptage' && <ComptageSection project={currentProject} />}
      {section === 'anomalies' && <AnomaliesSection project={currentProject} members={members} />}
      {section === 'journal' && <JournalSection project={currentProject} members={members} />}
    </div>
  );
};

const Header = ({ onClose }) => (
  <header className="flex items-start justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
        <Shield size={22} />
      </div>
      <div>
        <h1 className="text-2xl font-black tracking-tight">Anti-vol</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-[10px] mt-1">Investigation & contrôle</p>
      </div>
    </div>
    {onClose && (
      <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
        <X size={20} />
      </button>
    )}
  </header>
);

/* ============================================================
 * COMPTAGE PHYSIQUE
 * ============================================================ */
const ComptageSection = ({ project }) => {
  const [audits, setAudits] = useState([]);
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAuditId, setOpenAuditId] = useState(null); // pour voir détails d'un audit existant
  const [newAuditDraft, setNewAuditDraft] = useState(null); // {[product_id|city]: counted}
  const [auditNotes, setAuditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [auditEntries, setAuditEntries] = useState({}); // auditId -> entries[]

  useEffect(() => {
    if (project) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [auditsRes, prodRes, txRes] = await Promise.all([
        supabase.from('stock_audits')
          .select('*, profiles:performed_by(full_name)')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('project_id', project.id).order('name'),
        supabase.from('transactions')
          .select('product_id, quantity, town, categories(name)')
          .eq('project_id', project.id),
      ]);
      setAudits(auditsRes.data || []);
      setProducts(prodRes.data || []);
      setTransactions(txRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Stock théorique calculé par (produit × ville) depuis les transactions
  const theoreticalStock = useMemo(() => {
    const map = {}; // `${productId}|${city}` -> qty
    transactions.forEach((tx) => {
      if (!tx.product_id) return;
      const city = normalizeCity(tx.town);
      const key = `${tx.product_id}|${city}`;
      if (map[key] == null) map[key] = 0;
      const qty = Number(tx.quantity || 0);
      const cat = tx.categories?.name;
      if (cat === 'Vente') map[key] -= qty;
      else if (cat === 'Investissement' || cat === 'Achats produits') map[key] += qty;
    });
    return map;
  }, [transactions]);

  // Lignes proposées pour un nouveau comptage : tout couple produit×ville
  // ayant une activité transactionnelle. (Plus de fallback sur stock_quantity
  // statique — un produit sans aucune transaction a un stock de 0.)
  const countingRows = useMemo(() => {
    const set = new Set();
    Object.keys(theoreticalStock).forEach((k) => set.add(k));
    return Array.from(set).map((k) => {
      const [productId, city] = k.split('|');
      const product = products.find((p) => p.id === productId);
      return {
        key: k,
        productId,
        city,
        productName: product?.name || 'Produit supprimé',
        theoretical: Number(theoreticalStock[k] || 0),
      };
    }).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [theoreticalStock, products]);

  const startNewAudit = () => {
    const draft = {};
    countingRows.forEach((r) => { draft[r.key] = ''; });
    setNewAuditDraft(draft);
    setAuditNotes('');
  };

  const saveAudit = async () => {
    if (!newAuditDraft) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: audit, error: aErr } = await supabase
        .from('stock_audits')
        .insert([{ project_id: project.id, performed_by: user?.id, notes: auditNotes || null }])
        .select()
        .single();
      if (aErr) throw aErr;

      const entries = countingRows
        .filter((r) => newAuditDraft[r.key] !== '' && newAuditDraft[r.key] != null)
        .map((r) => ({
          audit_id: audit.id,
          product_id: r.productId,
          city: r.city,
          theoretical_qty: r.theoretical,
          counted_qty: Number(newAuditDraft[r.key]) || 0,
        }));

      if (entries.length > 0) {
        const { error: eErr } = await supabase.from('stock_audit_entries').insert(entries);
        if (eErr) throw eErr;
      }

      setNewAuditDraft(null);
      setAuditNotes('');
      fetchAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadAuditEntries = async (auditId) => {
    if (auditEntries[auditId]) {
      setOpenAuditId(openAuditId === auditId ? null : auditId);
      return;
    }
    const { data } = await supabase
      .from('stock_audit_entries')
      .select('*, products(name)')
      .eq('audit_id', auditId);
    setAuditEntries({ ...auditEntries, [auditId]: data || [] });
    setOpenAuditId(auditId);
  };

  if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Action principale */}
      {!newAuditDraft && (
        <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Nouveau comptage physique</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Compter la marchandise réelle et comparer au stock théorique. Tout écart négatif = perte à investiguer.</p>
            </div>
          </div>
          <button
            onClick={startNewAudit}
            className="flex items-center gap-2 bg-primary text-white px-4 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 shrink-0"
          >
            <Plus size={16} /> Démarrer
          </button>
        </div>
      )}

      {/* Formulaire de comptage */}
      {newAuditDraft && (
        <div className="glass-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="text-primary" size={20} />
              <h2 className="font-bold">Comptage en cours</h2>
            </div>
            <button
              onClick={() => setNewAuditDraft(null)}
              className="text-[10px] font-bold text-muted-foreground hover:text-white uppercase tracking-widest"
            >
              Annuler
            </button>
          </div>

          <textarea
            value={auditNotes}
            onChange={(e) => setAuditNotes(e.target.value)}
            placeholder="Notes (optionnel) — contexte, témoins, etc."
            rows={2}
            className="w-full bg-background border border-white/5 rounded-xl py-2 px-4 text-sm outline-none focus:border-primary transition-all resize-none"
          />

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="py-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest min-w-[140px]">Produit</th>
                  <th className="py-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest min-w-[80px]">Ville</th>
                  <th className="py-2 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest">Théorique</th>
                  <th className="py-2 text-right text-[10px] font-black uppercase text-primary tracking-widest min-w-[100px]">Compté</th>
                  <th className="py-2 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest">Écart</th>
                </tr>
              </thead>
              <tbody>
                {countingRows.map((r) => {
                  const counted = newAuditDraft[r.key];
                  const variance = counted === '' || counted == null ? null : Number(counted) - r.theoretical;
                  return (
                    <tr key={r.key} className="border-b border-white/5">
                      <td className="py-2 text-xs font-black">{r.productName}</td>
                      <td className="py-2 text-[10px] font-bold text-muted-foreground">{r.city}</td>
                      <td className="py-2 text-right text-xs font-bold">{fmt(r.theoretical)}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          step="any"
                          value={counted}
                          onChange={(e) => setNewAuditDraft({ ...newAuditDraft, [r.key]: e.target.value })}
                          className="w-20 bg-background border border-white/10 rounded-lg py-1.5 px-2 text-xs text-right focus:border-primary outline-none"
                          placeholder="—"
                        />
                      </td>
                      <td className="py-2 text-right">
                        {variance == null ? (
                          <span className="text-[10px] text-muted-foreground/60">—</span>
                        ) : (
                          <span className={`px-2 py-1 rounded text-xs font-black ${
                            variance === 0 ? 'text-white' : variance > 0 ? 'text-green-500 bg-green-500/5' : 'text-red-500 bg-red-500/10'
                          }`}>
                            {variance > 0 ? '+' : ''}{fmt(variance)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {countingRows.length === 0 && (
                  <tr><td colSpan="5" className="py-8 text-center text-muted-foreground italic text-sm">Aucun stock à compter.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={saveAudit}
            disabled={saving}
            className="w-full bg-primary text-white h-12 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={16} /> Enregistrer le comptage</>}
          </button>
        </div>
      )}

      {/* Historique */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <History size={20} className="text-primary" />
          <h2 className="font-bold">Historique des comptages</h2>
        </div>
        {audits.length === 0 ? (
          <p className="text-center py-8 text-xs text-muted-foreground italic">Aucun comptage enregistré.</p>
        ) : (
          <div className="space-y-3">
            {audits.map((a) => (
              <div key={a.id} className="bg-background border border-white/5 rounded-xl overflow-hidden">
                <button
                  onClick={() => loadAuditEntries(a.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-bold">
                      {new Date(a.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      <span className="text-[10px] text-muted-foreground ml-2">{new Date(a.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Par {a.profiles?.full_name || 'Inconnu'}</p>
                    {a.notes && <p className="text-[11px] text-muted-foreground italic mt-1">{a.notes}</p>}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-primary">{openAuditId === a.id ? 'Masquer' : 'Voir'}</div>
                </button>
                {openAuditId === a.id && (
                  <div className="border-t border-white/5 p-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="py-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Produit</th>
                          <th className="py-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ville</th>
                          <th className="py-2 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest">Théo.</th>
                          <th className="py-2 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest">Compté</th>
                          <th className="py-2 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest">Écart</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(auditEntries[a.id] || []).map((e) => (
                          <tr key={e.id} className="border-b border-white/5">
                            <td className="py-2 text-xs font-black">{e.products?.name || '—'}</td>
                            <td className="py-2 text-[10px] font-bold text-muted-foreground">{e.city}</td>
                            <td className="py-2 text-right text-xs font-bold">{fmt(e.theoretical_qty)}</td>
                            <td className="py-2 text-right text-xs font-bold">{fmt(e.counted_qty)}</td>
                            <td className="py-2 text-right">
                              <span className={`px-2 py-1 rounded text-xs font-black ${
                                Number(e.variance) === 0 ? 'text-white' : Number(e.variance) > 0 ? 'text-green-500 bg-green-500/5' : 'text-red-500 bg-red-500/10'
                              }`}>
                                {Number(e.variance) > 0 ? '+' : ''}{fmt(e.variance)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
 * ANOMALIES
 * ============================================================ */
const AnomaliesSection = ({ project, members }) => {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (project) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txRes, prodRes] = await Promise.all([
        supabase.from('transactions')
          .select('*, categories(name), profiles:user_id(full_name)')
          .eq('project_id', project.id),
        supabase.from('products').select('*').eq('project_id', project.id),
      ]);
      setTransactions(txRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const anomalies = useMemo(() => {
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));

    // 1. Ventes à perte : pour une ligne Vente, prix unitaire < prix d'achat
    const ventesAPerte = transactions
      .filter((t) => t.categories?.name === 'Vente' && t.product_id && Number(t.quantity || 0) > 0)
      .map((t) => {
        const p = productById[t.product_id];
        if (!p) return null;
        const unit = Number(t.amount) / Number(t.quantity);
        const cost = Number(p.purchase_price || 0);
        if (cost === 0 || unit >= cost) return null;
        return { tx: t, product: p, unit, cost, loss: (cost - unit) * Number(t.quantity) };
      })
      .filter(Boolean)
      .sort((a, b) => b.loss - a.loss);

    // 2. Stock négatif : par produit × ville, sorties > entrées
    const balances = {}; // `${pid}|${city}` -> {in, out, productName, city}
    transactions.forEach((t) => {
      if (!t.product_id) return;
      const city = normalizeCity(t.town);
      const key = `${t.product_id}|${city}`;
      if (!balances[key]) balances[key] = { stockIn: 0, stockOut: 0, productId: t.product_id, city };
      const qty = Number(t.quantity || 0);
      const cat = t.categories?.name;
      if (cat === 'Vente') balances[key].stockOut += qty;
      else if (cat === 'Investissement' || cat === 'Achats produits') balances[key].stockIn += qty;
    });
    const stockNegatif = Object.values(balances)
      .map((b) => ({ ...b, balance: b.stockIn - b.stockOut, productName: productById[b.productId]?.name || '—' }))
      .filter((b) => b.balance < 0)
      .sort((a, b) => a.balance - b.balance);

    // 3. Membres déficitaires (revenus - dépenses < 0 sur 30 jours), Salaire/Capital exclus
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceISO = since.toISOString().slice(0, 10);
    const memberAgg = {};
    transactions.forEach((t) => {
      if (!t.user_id || t.exclude_from_global) return;
      const cat = t.categories?.name;
      if (cat === 'Salaire' || cat === 'Capital') return;
      if (t.date && t.date < sinceISO) return;
      if (!memberAgg[t.user_id]) memberAgg[t.user_id] = { revenue: 0, expense: 0 };
      const amt = Number(t.amount || 0);
      if (t.type === 'income') {
        if (t.payment_status !== 'unpaid') memberAgg[t.user_id].revenue += amt;
      } else {
        memberAgg[t.user_id].expense += amt;
      }
    });
    const membresDeficitaires = Object.entries(memberAgg)
      .map(([uid, a]) => ({ uid, ...a, net: a.revenue - a.expense, name: members.find((m) => m.id === uid)?.full_name || 'Inconnu' }))
      .filter((m) => m.net < 0)
      .sort((a, b) => a.net - b.net);

    return { ventesAPerte, stockNegatif, membresDeficitaires };
  }, [transactions, products, members]);

  if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  const hasAny = anomalies.ventesAPerte.length || anomalies.stockNegatif.length || anomalies.membresDeficitaires.length;

  return (
    <div className="space-y-6">
      {!hasAny && (
        <div className="glass-card p-10 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
            <Shield size={28} />
          </div>
          <p className="text-sm font-bold">Aucune anomalie détectée</p>
          <p className="text-[11px] text-muted-foreground">Continuez à surveiller régulièrement.</p>
        </div>
      )}

      {/* Ventes à perte */}
      {anomalies.ventesAPerte.length > 0 && (
        <AnomalyCard
          title="Ventes à perte"
          desc="Lignes où le prix de vente unitaire est en-dessous du prix d'achat."
          icon={TrendingDown}
          color="red"
          count={anomalies.ventesAPerte.length}
        >
          <div className="space-y-2">
            {anomalies.ventesAPerte.slice(0, 10).map((a) => (
              <div key={a.tx.id} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                <div>
                  <p className="text-sm font-bold">{a.product.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {a.tx.profiles?.full_name || 'Inconnu'} • {new Date(a.tx.date).toLocaleDateString('fr-FR')} • {normalizeCity(a.tx.town)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Vendu {fmt(a.unit)} F vs coût {fmt(a.cost)} F → perte {fmt(a.loss)} F
                  </p>
                </div>
                <span className="text-xs font-black text-red-500">-{fmt(a.loss)} F</span>
              </div>
            ))}
          </div>
        </AnomalyCard>
      )}

      {/* Stock négatif */}
      {anomalies.stockNegatif.length > 0 && (
        <AnomalyCard
          title="Stock négatif"
          desc="Plus de sorties que d'entrées sur ces lignes — manipulation à vérifier."
          icon={PackageX}
          color="orange"
          count={anomalies.stockNegatif.length}
        >
          <div className="space-y-2">
            {anomalies.stockNegatif.map((b, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl">
                <div>
                  <p className="text-sm font-bold">{b.productName}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{b.city} • Entrées {fmt(b.stockIn)} / Sorties {fmt(b.stockOut)}</p>
                </div>
                <span className="text-xs font-black text-orange-500">{fmt(b.balance)}</span>
              </div>
            ))}
          </div>
        </AnomalyCard>
      )}

      {/* Membres déficitaires */}
      {anomalies.membresDeficitaires.length > 0 && (
        <AnomalyCard
          title="Membres en déficit (30j)"
          desc="Ce membre a dépensé plus qu'il n'a rapporté sur 30 jours."
          icon={UserX}
          color="purple"
          count={anomalies.membresDeficitaires.length}
          sensitive
        >
          <div className="space-y-2">
            {anomalies.membresDeficitaires.map((m) => (
              <div key={m.uid} className="flex items-center justify-between p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                <div>
                  <p className="text-sm font-bold">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Revenus {fmt(m.revenue)} F • Dépenses {fmt(m.expense)} F
                  </p>
                </div>
                <span className="text-xs font-black text-purple-500">{fmt(m.net)} F</span>
              </div>
            ))}
          </div>
        </AnomalyCard>
      )}
    </div>
  );
};

const COLOR_CLASSES = {
  red: { bg: 'bg-red-500/10', text: 'text-red-500' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  green: { bg: 'bg-green-500/10', text: 'text-green-500' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
};

const AnomalyCard = ({ title, desc, icon: Icon, color, count, sensitive, children }) => {
  const c = COLOR_CLASSES[color] || COLOR_CLASSES.red;
  return (
  <div className="glass-card p-6 space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.bg} ${c.text}`}>
          <Icon size={18} />
        </div>
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">
            {title}
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{count}</span>
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
          {sensitive && <p className="text-[10px] text-orange-500/80 italic mt-1">Information confidentielle — pour usage propriétaire.</p>}
        </div>
      </div>
    </div>
    {children}
  </div>
  );
};

/* ============================================================
 * JOURNAL D'ACTIVITÉ
 * ============================================================ */
const ACTION_META = {
  insert: { icon: Plus, color: 'green', label: 'Création' },
  update: { icon: Pencil, color: 'blue', label: 'Modification' },
  delete: { icon: Trash2, color: 'red', label: 'Suppression' },
};

const JournalSection = ({ project, members }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  useEffect(() => {
    if (project) fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('activity_log')
        .select('*, profiles:user_id(full_name)')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(500);
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter((l) =>
    (filterAction === 'all' || l.action === filterAction) &&
    (filterUser === 'all' || l.user_id === filterUser)
  );

  if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ScrollText size={20} className="text-primary" />
          <h2 className="font-bold">Journal d'activité</h2>
          <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} entrées</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', 'insert', 'update', 'delete'].map((a) => (
            <button
              key={a}
              onClick={() => setFilterAction(a)}
              className={`px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                filterAction === a ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground hover:text-white'
              }`}
            >
              {a === 'all' ? 'Tous' : ACTION_META[a].label}
            </button>
          ))}
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="bg-background border border-white/5 rounded-lg px-3 h-8 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-primary appearance-none cursor-pointer ml-auto"
          >
            <option value="all">Tous les membres</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-xs text-muted-foreground italic">Aucune activité enregistrée pour ce filtre.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => {
            const meta = ACTION_META[l.action] || ACTION_META.update;
            const Icon = meta.icon;
            return (
              <div key={l.id} className={`bg-background border border-white/5 rounded-xl p-4 flex items-start gap-3`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-${meta.color}-500/10 text-${meta.color}-500`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-bold truncate">{l.summary || `${meta.label} ${l.entity_type}`}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(l.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                    <span className={`text-${meta.color}-500 font-black`}>{meta.label}</span> • {l.profiles?.full_name || 'Inconnu'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AntiVol;
