import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, CartesianGrid,
  LabelList
} from 'recharts';
import { 
  TrendingUp, 
  Package, 
  MapPin, 
  DollarSign, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  ShoppingBag,
  Globe,
  PieChart as PieChartIcon,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import CalculationDetailsModal from './CalculationDetailsModal';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Statistics = () => {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Product Management State
  const [showProductForm, setShowProductForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', purchase_price: '' });
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // Filter State
  const [selectedCityFilter, setSelectedCityFilter] = useState('all');
  const [cityMetric, setCityMetric] = useState('revenue'); // 'revenue' or 'profit'
  const [selectedDetailsData, setSelectedDetailsData] = useState(null);

  useEffect(() => {
    if (currentProject) {
      fetchData();
    }
  }, [currentProject]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, txRes, catRes] = await Promise.all([
        supabase.from('products').select('*').eq('project_id', currentProject.id).order('name'),
        supabase.from('transactions').select('*, categories(name, type)').eq('project_id', currentProject.id),
        supabase.from('categories').select('*')
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (txRes.data) setTransactions(txRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !currentProject) return;
    setIsAddingProduct(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          ...newProduct,
          purchase_price: parseFloat(newProduct.purchase_price) || 0,
          project_id: currentProject.id
        }])
        .select()
        .single();
      
      if (error) throw error;
      setProducts([...products, data]);
      setNewProduct({ name: '', sku: '', purchase_price: '' });
      setShowProductForm(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  // --- ANALYTICS CALCULATIONS ---
  const stats = useMemo(() => {
    const cityData = {};
    const dailySeries = {}; // YYYY-MM-DD -> { name, revenue }
    
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalPiecesSold = 0;
    let totalSalesCount = 0;
    let totalPublicity = 0;

    const incomeBreakdown = {};
    const expenseBreakdown = {};

    transactions.forEach(tx => {
      const catName = tx.categories?.name;
      const amount = Number(tx.amount);
      const qty = Number(tx.quantity || 1);
      const date = tx.date;
      const city = tx.town || 'Inconnu';
      const prodId = tx.product_id;

      // EXCLUSION LOGIC: Capital is Cash Flow, not Performance
      const isPerformanceExclusion = tx.exclude_from_global || catName === 'Capital';

      if (!cityData[city]) {
        cityData[city] = { 
          income: 0, expense: 0, revenue: 0, piecesSold: 0, inventory: {},
          incomeBreakdown: {}, expenseBreakdown: {}
        };
      }

      // 1. CASH FLOW TRACKING (For "Safe to Spend" type metrics)
      if (tx.type === 'income') {
        cityData[city].income += amount;
        
        // PERFORMANCE TRACKING: Only "Vente" and non-capital income counts as revenue
        if (!isPerformanceExclusion) {
          totalRevenue += amount;
          cityData[city].incomeBreakdown[catName] = (cityData[city].incomeBreakdown[catName] || 0) + amount;
          incomeBreakdown[catName] = (incomeBreakdown[catName] || 0) + amount;

          if (catName === 'Vente') {
            totalPiecesSold += qty;
            totalSalesCount++;
            cityData[city].revenue += amount;
            cityData[city].piecesSold += qty;
            
            // Daily Sales
            if (!dailySeries[date]) dailySeries[date] = { name: date, revenue: 0 };
            dailySeries[date].revenue += amount;
          }
        }
      } else {
        cityData[city].expense += amount;
        
        // PERFORMANCE TRACKING: All expenses count against profit (except maybe some exclusions)
        if (!tx.exclude_from_global) {
          totalExpenses += amount;
          cityData[city].expenseBreakdown[catName] = (cityData[city].expenseBreakdown[catName] || 0) + amount;
          expenseBreakdown[catName] = (expenseBreakdown[catName] || 0) + amount;

          if (catName === 'Publicité') totalPublicity += amount;
        }
      }

      // 2. INVENTORY TRACKING
      if (prodId) {
        if (!cityData[city].inventory[prodId]) {
          cityData[city].inventory[prodId] = { stockIn: 0, stockOut: 0, balance: 0, stockInAmount: 0 };
        }
        if (catName === 'Vente') {
          cityData[city].inventory[prodId].stockOut += qty;
          cityData[city].inventory[prodId].balance -= qty;
        }
        if (catName === 'Investissement') {
          cityData[city].inventory[prodId].stockIn += qty;
          cityData[city].inventory[prodId].balance += qty;
          cityData[city].inventory[prodId].stockInAmount += amount;
        }
      }
    });

    const netProfit = totalRevenue - totalExpenses;
    const averageOrderValue = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;
    
    // Sort daily series by date
    const timeSeries = Object.values(dailySeries).sort((a, b) => a.name.localeCompare(b.name));

    // Calculate Inventory Value
    let totalInventoryValue = 0;
    Object.values(cityData).forEach(city => {
      Object.entries(city.inventory).forEach(([pId, data]) => {
        if (data.balance > 0 && data.stockIn > 0) {
          const avgCost = data.stockInAmount / data.stockIn;
          totalInventoryValue += data.balance * avgCost;
        }
      });
    });

    // Top Expenses Calculations (Operational only)
    const sortedExpenses = Object.entries(expenseBreakdown)
      .filter(([name]) => name !== 'Investissement')
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const cityPerformances = Object.entries(cityData).map(([name, d]) => ({ 
      name, 
      revenue: d.revenue, 
      profit: d.revenue - d.expense, // Simplification: Business profit in that city
      incomeBreakdown: d.incomeBreakdown,
      expenseBreakdown: d.expenseBreakdown
    })).sort((a, b) => b.revenue - a.revenue);

    return { 
      totalRevenue, totalPiecesSold, netProfit, totalPublicity, averageOrderValue, totalInventoryValue,
      charts: { 
        timeSeries, 
        salesByCity: cityPerformances,
        topExpenses: sortedExpenses,
        inventory: Object.entries(cityData).flatMap(([cityName, d]) => 
          Object.entries(d.inventory).map(([pId, data]) => ({
            city: cityName,
            product: products.find(p => p.id === pId)?.name || 'Inconnu',
            stockIn: data.stockIn, stockOut: data.stockOut, balance: data.balance
          }))
        ),
        cities: ['all', ...Object.keys(cityData).sort()]
      }
    };
  }, [transactions, products]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Statistiques Business</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-[10px] mt-1">Analyse de rentabilité et stocks</p>
      </header>

      {/* Top Level KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Chiffre d\'Affaires', value: stats.totalRevenue, icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Bénéfice Net', value: stats.netProfit, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Valeur du Stock Restant', value: stats.totalInventoryValue, icon: Package, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Unités Vendues', value: stats.totalPiecesSold, icon: ShoppingBag, color: 'text-purple-500', bg: 'bg-purple-500/10', suffix: ' pcs' },
          { label: 'Panier Moyen', value: stats.averageOrderValue, icon: ArrowUpRight, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
          { label: 'Frais Publicité', value: stats.totalPublicity, icon: Tag, color: 'text-red-500', bg: 'bg-red-500/10' },
        ].map((kpi, i) => (
          <div key={i} className="glass-card p-4 flex flex-col justify-between min-h-[120px]">
            <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">{kpi.label}</p>
              <p className={`text-lg font-black mt-1 ${kpi.color} truncate`}>
                {new Intl.NumberFormat('fr-FR').format(kpi.value)} {kpi.suffix || 'F'}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Calculation Breakdown Banner */}
      <section className="glass-card bg-primary/5 border-primary/20 p-4 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-center animate-in fade-in zoom-in-95 duration-700">
        <div className="space-y-1">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">Chiffre d'Affaires</p>
          <p className="text-sm font-black text-white">{new Intl.NumberFormat('fr-FR').format(stats.totalRevenue)} F</p>
        </div>
        <div className="text-primary font-black text-xl">-</div>
        <div className="space-y-1">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Dépenses</p>
          <p className="text-sm font-black text-white">{new Intl.NumberFormat('fr-FR').format(stats.totalRevenue - stats.netProfit)} F</p>
        </div>
        <div className="text-primary font-black text-xl">=</div>
        <div className="px-6 py-2 bg-primary/10 rounded-2xl border border-primary/20">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-primary">Bénéfice Net</p>
          <p className="text-lg font-black text-primary">{new Intl.NumberFormat('fr-FR').format(stats.netProfit)} F</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inventory Per City */}
        <section className="col-span-12 lg:col-span-8 space-y-6">
          <div className="glass-card p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-2">
                <MapPin className="text-primary" size={20} />
                <h1 className="font-bold">Détails des Stocks</h1>
              </div>

              {/* City Filter */}
              <div className="relative min-w-[180px]">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={14} />
                <select 
                  value={selectedCityFilter}
                  onChange={(e) => setSelectedCityFilter(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs font-bold uppercase tracking-wider outline-none focus:border-primary appearance-none transition-all"
                >
                  <option value="all">Toutes les villes</option>
                  {stats.charts.cities.filter(c => c !== 'all').map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest min-w-[100px]">Ville</th>
                    <th className="py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest min-w-[120px]">Produit</th>
                    <th className="py-3 text-right text-[10px] font-black uppercase text-green-500 tracking-widest">Entrées</th>
                    <th className="py-3 text-right text-[10px] font-black uppercase text-orange-500 tracking-widest">Sorties</th>
                    <th className="py-3 text-right text-[10px] font-black uppercase text-white tracking-widest">Reste</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.charts.inventory
                    .filter(item => selectedCityFilter === 'all' || item.city === selectedCityFilter)
                    .map((item, idx) => (
                    <tr key={idx} className="border-b border-white/5 group hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 text-[10px] font-bold text-muted-foreground flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                        {item.city}
                      </td>
                      <td className="py-4 text-xs font-black">{item.product}</td>
                      <td className="py-4 text-right text-xs font-bold text-green-500/80">+{item.stockIn}</td>
                      <td className="py-4 text-right text-xs font-bold text-orange-500/80">-{item.stockOut}</td>
                      <td className="py-4 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-black ${
                          item.balance > 5 ? 'text-white' : 
                          item.balance > 0 ? 'text-yellow-500 bg-yellow-500/5' : 'text-red-500 bg-red-500/5'
                        }`}>
                          {item.balance}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {stats.charts.inventory.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-10 text-center text-muted-foreground italic text-sm">Aucun mouvement de stock détecté.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Sales Chart - Large & Premium */}
          <div className="col-span-12 glass-card p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="text-primary" size={24} />
                  Évolution des Ventes
                </h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-1">Chiffre d'affaires journalier (Ventes réelles)</p>
              </div>
              <div className="px-4 py-2 bg-primary/10 rounded-2xl border border-primary/20">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest block leading-none mb-1">Moyenne Quotidienne</span>
                <span className="text-lg font-black text-white">{new Intl.NumberFormat('fr-FR').format(stats.totalRevenue / Math.max(stats.charts.timeSeries.length, 1))} F</span>
              </div>
            </div>
            
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.charts.timeSeries}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#ffffff" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(str) => {
                      const d = new Date(str);
                      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                    }}
                  />
                  <YAxis 
                    stroke="#ffffff" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', fontSize: '11px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#3b82f6', fontWeight: '900' }}
                    labelStyle={{ color: '#737373', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#3b82f6" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Sidebar: Product Management & City Chart */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">
           {/* Product List/Manager */}
           <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="text-primary" size={20} />
                <h2 className="font-bold">Mes Produits</h2>
              </div>
              <button 
                onClick={() => setShowProductForm(!showProductForm)}
                className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-primary"
              >
                <Plus size={18} />
              </button>
            </div>

            {showProductForm && (
              <form onSubmit={handleAddProduct} className="mb-6 p-4 bg-white/5 rounded-2xl border border-primary/20 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <input
                  type="text"
                  placeholder="Nom du produit..."
                  className="w-full bg-background border border-white/10 rounded-xl py-2 px-3 text-xs outline-none focus:border-primary transition-all"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="SKU (Optionnel)"
                    className="w-full bg-background border border-white/10 rounded-xl py-2 px-3 text-xs outline-none focus:border-primary transition-all"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                  />
                  <input
                    type="number"
                    placeholder="Prix d'achat"
                    className="w-full bg-background border border-white/10 rounded-xl py-2 px-3 text-xs outline-none focus:border-primary transition-all"
                    value={newProduct.purchase_price}
                    onChange={(e) => setNewProduct({...newProduct, purchase_price: e.target.value})}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isAddingProduct}
                  className="w-full bg-primary text-white h-9 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  {isAddingProduct ? <Loader2 className="animate-spin" size={14} /> : <><Save size={14} /> Ajouter</>}
                </button>
              </form>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {products.map(p => (
                <div key={p.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group">
                  <div>
                    <p className="text-xs font-bold">{p.name}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">{p.sku || 'Sans SKU'} • {new Intl.NumberFormat('fr-FR').format(p.purchase_price)} FCFA/unité</p>
                  </div>
                  <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {products.length === 0 && <p className="text-center py-6 text-[10px] text-muted-foreground italic">Aucun produit configuré.</p>}
            </div>
          </div>

          {/* TOP CATEGORIES DÉPENSES */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Tag className="text-red-500" size={20} />
              <h2 className="font-bold">Postes de Dépenses</h2>
            </div>
            
            <div className="space-y-6">
              {stats.charts.topExpenses.length > 0 ? (
                stats.charts.topExpenses.slice(0, 5).map((exp, i) => {
                  const percentage = (exp.value / stats.charts.topExpenses.reduce((acc, curr) => acc + curr.value, 0)) * 100;
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-black text-white">{exp.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">{new Intl.NumberFormat('fr-FR').format(exp.value)} F</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-red-500/50 rounded-full transition-all duration-1000"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center py-10 text-[10px] text-muted-foreground italic">Aucune dépense opérationnelle enregistrée.</p>
              )}
            </div>
          </div>

          {/* CA Par Ville - Bar Chart Horizontal */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold flex items-center gap-2">
                <MapPin className="text-primary" size={20} />
                Ventes par Ville
              </h2>
            </div>

            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.charts.salesByCity} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="#ffffff" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', fontSize: '10px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(val) => [`${new Intl.NumberFormat('fr-FR').format(val)} F`, 'Revenu']}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    <LabelList 
                      dataKey="revenue" 
                      position="right" 
                      formatter={(val) => `${new Intl.NumberFormat('fr-FR').format(val)} F`}
                      fill="#ffffff"
                      fontSize={10}
                      fontWeight="bold"
                    />
                    {stats.charts.salesByCity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 mt-4">
              {stats.charts.salesByCity.slice(0, 3).map((city, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-[10px]">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="font-bold text-white uppercase">{city.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-primary">{new Intl.NumberFormat('fr-FR').format(city.revenue)} F</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      <CalculationDetailsModal 
        isOpen={!!selectedDetailsData}
        onClose={() => setSelectedDetailsData(null)}
        data={selectedDetailsData || {}}
        title={selectedDetailsData ? `Détails - ${selectedDetailsData.name}` : "Détails"}
      />
    </div>
  );
};

export default Statistics;
