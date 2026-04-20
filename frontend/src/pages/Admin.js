import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Pencil, Trash2, ArrowLeft, Package, ShoppingBag, Save, Upload, BarChart3, AlertTriangle, TrendingUp, Boxes, Shield, ShieldOff, Key, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CATEGORIES = ['Skincare', 'Makeup', 'Fragrance', 'Haircare', 'Body'];
const emptyProduct = { name: '', description: '', price: '', category: 'Skincare', image_url: '', stock: '100', featured: false };

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { format } = useCurrency();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('products');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [twoFaStatus, setTwoFaStatus] = useState(null);
  const [twoFaSetupData, setTwoFaSetupData] = useState(null);
  const [securityPhase, setSecurityPhase] = useState('idle');
  const [securityCode, setSecurityCode] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) navigate('/');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.role === 'admin') fetchData();
  }, [user]);

  useEffect(() => {
    if (tab === 'security' && user?.role === 'admin') {
      axios.get(`${API}/admin/2fa/status`, { withCredentials: true })
        .then(res => setTwoFaStatus(res.data))
        .catch(() => {});
    }
  }, [tab, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, orderRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/admin/orders`, { withCredentials: true }),
        axios.get(`${API}/admin/analytics`, { withCredentials: true })
      ]);
      setProducts(prodRes.data);
      setOrders(orderRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditId(null); setForm(emptyProduct); setModalOpen(true); };
  const openEdit = (p) => {
    setEditId(p.id);
    setForm({ name: p.name, description: p.description, price: String(p.price), category: p.category, image_url: p.image_url, stock: String(p.stock), featured: p.featured || false });
    setModalOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await axios.post(`${API}/upload/image`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const imageUrl = `${process.env.REACT_APP_BACKEND_URL}${data.url}`;
      setForm(prev => ({ ...prev, image_url: imageUrl }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.category) {
      toast.error('Name, price, and category are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, price: parseFloat(form.price), stock: parseInt(form.stock) || 100 };
      if (editId) {
        await axios.put(`${API}/admin/products/${editId}`, payload, { withCredentials: true });
        toast.success('Product updated');
      } else {
        await axios.post(`${API}/admin/products`, payload, { withCredentials: true });
        toast.success('Product created');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handle2FASetup = async () => {
    setSecurityLoading(true);
    try {
      const { data } = await axios.post(`${API}/admin/2fa/setup`, {}, { withCredentials: true });
      setTwoFaSetupData(data);
      setBackupCodes(data.backup_codes);
      setSecurityPhase('setup');
    } catch (err) { toast.error(err.response?.data?.detail || '2FA setup failed'); }
    finally { setSecurityLoading(false); }
  };

  const handle2FAConfirm = async () => {
    setSecurityLoading(true);
    try {
      await axios.post(`${API}/admin/2fa/confirm`, { code: securityCode }, { withCredentials: true });
      toast.success('2FA enabled successfully');
      setTwoFaStatus({ enabled: true, has_backup_codes: true });
      setSecurityPhase('idle'); setSecurityCode(''); setTwoFaSetupData(null);
    } catch (err) { toast.error(err.response?.data?.detail || 'Invalid code'); }
    finally { setSecurityLoading(false); }
  };

  const handle2FADisable = async () => {
    setSecurityLoading(true);
    try {
      await axios.post(`${API}/admin/2fa/disable`, { code: securityCode }, { withCredentials: true });
      toast.success('2FA disabled');
      setTwoFaStatus({ enabled: false, has_backup_codes: false });
      setSecurityPhase('idle'); setSecurityCode('');
    } catch (err) { toast.error(err.response?.data?.detail || 'Invalid code'); }
    finally { setSecurityLoading(false); }
  };

  const handle2FARegenBackup = async () => {
    setSecurityLoading(true);
    try {
      const { data } = await axios.post(`${API}/admin/2fa/backup-codes/regenerate`, { code: securityCode }, { withCredentials: true });
      setBackupCodes(data.backup_codes);
      setSecurityPhase('regen'); setSecurityCode('');
      toast.success('Backup codes regenerated');
    } catch (err) { toast.error(err.response?.data?.detail || 'Invalid code'); }
    finally { setSecurityLoading(false); }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`${API}/admin/products/${productId}`, { withCredentials: true });
      toast.success('Product deleted');
      fetchData();
    } catch { toast.error('Failed to delete'); }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="admin-page" className="min-h-screen pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <button data-testid="admin-back-btn" onClick={() => navigate('/')} className="flex items-center gap-2 text-[#A1A1AA] hover:text-white text-sm font-body mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Store
        </button>

        <div className="flex items-center justify-between mb-8">
          <h1 className="font-heading text-3xl text-white tracking-tight">Admin Panel</h1>
          {tab === 'products' && (
            <Button data-testid="add-product-btn" onClick={openCreate} className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body text-sm">
              <Plus className="w-4 h-4 mr-1" /> Add Product
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#18181B] rounded-lg p-1 w-fit overflow-x-auto">
          {[
            { id: 'products', icon: Package, label: `Products (${products.length})` },
            { id: 'sales', icon: BarChart3, label: 'Sales & Stock' },
            { id: 'orders', icon: ShoppingBag, label: `Orders (${orders.length})` },
            { id: 'security', icon: Shield, label: 'Security' },
          ].map(t => (
            <button
              key={t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-body whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[#D4AF37] text-black' : 'text-[#A1A1AA] hover:text-white'}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>

        {/* ─── PRODUCTS TAB ─── */}
        {tab === 'products' && (
          <div className="grid gap-3">
            {products.map(p => (
              <div key={p.id} data-testid={`admin-product-${p.id}`} className="bg-[#18181B] border border-[#27272A] rounded-lg p-4 flex items-center gap-4">
                <img src={p.image_url} alt={p.name} className="w-14 h-18 object-cover rounded-md shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-body text-white truncate">{p.name}</h3>
                  <p className="text-xs text-[#A1A1AA] font-body">{p.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-body text-[#D4AF37] block">{format(p.price)}</span>
                  <span className={`text-xs font-body ${p.stock < 20 ? 'text-amber-400' : 'text-[#A1A1AA]'}`}>
                    Stock: {p.stock}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button data-testid={`edit-product-${p.id}`} onClick={() => openEdit(p)} className="p-2 text-[#A1A1AA] hover:text-white transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button data-testid={`delete-product-${p.id}`} onClick={() => handleDelete(p.id)} className="p-2 text-[#A1A1AA] hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── SALES & STOCK TAB ─── */}
        {tab === 'sales' && analytics && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-body text-[#A1A1AA]">Total Revenue</span>
                </div>
                <p data-testid="total-revenue" className="font-heading text-2xl text-white">{format(analytics.total_revenue)}</p>
              </div>
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-body text-[#A1A1AA]">Total Orders</span>
                </div>
                <p data-testid="total-orders" className="font-heading text-2xl text-white">{analytics.total_orders}</p>
              </div>
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-body text-[#A1A1AA]">Products</span>
                </div>
                <p data-testid="total-products" className="font-heading text-2xl text-white">{analytics.total_products}</p>
              </div>
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Boxes className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-body text-[#A1A1AA]">Total Stock</span>
                </div>
                <p data-testid="total-stock" className="font-heading text-2xl text-white">{analytics.total_stock}</p>
              </div>
            </div>

            {/* Stock by Category */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
              <h3 className="font-heading text-lg text-white mb-4">Stock by Category</h3>
              <div className="space-y-4">
                {Object.entries(analytics.category_stock).map(([cat, stock]) => (
                  <div key={cat} data-testid={`stock-${cat.toLowerCase()}`}>
                    <div className="flex justify-between text-sm font-body mb-1.5">
                      <span className="text-white">{cat}</span>
                      <span className="text-[#A1A1AA]">{stock} units</span>
                    </div>
                    <Progress
                      value={Math.min((stock / analytics.total_stock) * 100, 100)}
                      className="h-2 bg-[#27272A]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue by Category */}
            {Object.keys(analytics.category_revenue).length > 0 && (
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                <h3 className="font-heading text-lg text-white mb-4">Revenue by Category</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.category_revenue).map(([cat, rev]) => (
                    <div key={cat} className="flex justify-between items-center">
                      <span className="text-sm font-body text-white">{cat}</span>
                      <span className="text-sm font-body text-[#D4AF37]">{format(rev)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low Stock Alerts */}
            {analytics.low_stock_items.length > 0 && (
              <div className="bg-[#18181B] border border-amber-500/20 rounded-xl p-6">
                <h3 className="font-heading text-lg text-amber-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Low Stock Alerts
                </h3>
                <div className="space-y-2">
                  {analytics.low_stock_items.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm font-body">
                      <span className="text-white">{item.name}</span>
                      <span className="text-amber-400 font-medium">{item.stock} left</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inventory Table */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
              <h3 className="font-heading text-lg text-white mb-4">Full Inventory</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#27272A]">
                      <th className="text-left text-xs font-body text-[#A1A1AA] pb-3 pr-4">Product</th>
                      <th className="text-left text-xs font-body text-[#A1A1AA] pb-3 pr-4">Category</th>
                      <th className="text-right text-xs font-body text-[#A1A1AA] pb-3 pr-4">Price</th>
                      <th className="text-right text-xs font-body text-[#A1A1AA] pb-3">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} data-testid={`inventory-${p.id}`} className="border-b border-[#27272A]/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <img src={p.image_url} alt={p.name} className="w-8 h-10 object-cover rounded" />
                            <span className="text-sm font-body text-white">{p.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-sm font-body text-[#A1A1AA]">{p.category}</td>
                        <td className="py-3 pr-4 text-right text-sm font-body text-[#D4AF37]">{format(p.price)}</td>
                        <td className={`py-3 text-right text-sm font-body font-medium ${p.stock < 20 ? 'text-amber-400' : 'text-white'}`}>
                          {p.stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── ORDERS TAB ─── */}
        {tab === 'orders' && (
          <div className="grid gap-3">
            {orders.length === 0 ? (
              <p className="text-[#A1A1AA] text-sm font-body text-center py-12">No orders yet</p>
            ) : (
              orders.map(o => (
                <div key={o.id} data-testid={`admin-order-${o.id}`} className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#A1A1AA] font-body">Order #{o.id?.slice(0, 8)}</span>
                    <span className={`text-xs font-body px-2 py-0.5 rounded ${o.status === 'confirmed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                      {o.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white font-body">{o.items?.length || 0} item(s)</p>
                      <p className="text-xs text-[#A1A1AA] font-body">{o.shipping_address?.city}, {o.shipping_address?.zip_code}</p>
                    </div>
                    <span className="text-lg font-body text-[#D4AF37]">{format(o.total)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

        {/* ─── SECURITY TAB ─── */}
        {tab === 'security' && (
          <div className="max-w-lg space-y-6">
            <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                {twoFaStatus?.enabled
                  ? <Shield className="w-5 h-5 text-green-400" />
                  : <ShieldOff className="w-5 h-5 text-[#A1A1AA]" />}
                <div>
                  <h3 className="font-heading text-lg text-white">Two-Factor Authentication</h3>
                  <p className="text-xs text-[#A1A1AA]">
                    {twoFaStatus?.enabled ? 'Enabled — your account is protected' : 'Disabled — enable to secure your admin account'}
                  </p>
                </div>
              </div>

              {/* Not yet setup */}
              {!twoFaStatus?.enabled && securityPhase === 'idle' && (
                <Button onClick={handle2FASetup} disabled={securityLoading} className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body text-sm">
                  <Key className="w-4 h-4 mr-2" /> {securityLoading ? 'Setting up...' : 'Enable 2FA'}
                </Button>
              )}

              {/* Setup: show QR + confirm */}
              {securityPhase === 'setup' && twoFaSetupData && (
                <div className="space-y-4">
                  <p className="text-xs text-[#A1A1AA]">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                  <img src={twoFaSetupData.qr_png} alt="QR Code" className="w-40 h-40 rounded border border-[#27272A] bg-white p-1" />
                  <div>
                    <p className="text-xs text-[#A1A1AA] mb-1">Manual key (if you can't scan):</p>
                    <code className="text-xs text-[#D4AF37] bg-[#09090B] px-2 py-1 rounded break-all">{twoFaSetupData.manual_key}</code>
                  </div>
                  <div>
                    <p className="text-xs text-amber-400 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Save these backup codes — shown once only
                    </p>
                    <div className="grid grid-cols-2 gap-1 bg-[#09090B] rounded p-3">
                      {backupCodes.map((c, i) => <code key={i} className="text-xs text-white font-mono">{c}</code>)}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[#A1A1AA] text-xs">Enter the 6-digit code from your app to confirm</Label>
                    <Input value={securityCode} onChange={e => setSecurityCode(e.target.value)} className="bg-[#09090B] border-[#27272A] text-white w-40 text-center tracking-widest" placeholder="000000" maxLength={6} />
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handle2FAConfirm} disabled={securityLoading || !securityCode} className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body text-sm">
                      {securityLoading ? 'Confirming...' : 'Confirm & Activate'}
                    </Button>
                    <Button variant="outline" onClick={() => { setSecurityPhase('idle'); setSecurityCode(''); setTwoFaSetupData(null); }} className="border-[#27272A] text-white hover:bg-[#27272A] font-body text-sm">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Enabled: show disable + regen backup */}
              {twoFaStatus?.enabled && securityPhase === 'idle' && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Button onClick={() => setSecurityPhase('disable')} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 font-body text-sm">
                      <ShieldOff className="w-4 h-4 mr-2" /> Disable 2FA
                    </Button>
                    <Button onClick={() => setSecurityPhase('regen_confirm')} variant="outline" className="border-[#27272A] text-[#A1A1AA] hover:bg-[#27272A] font-body text-sm">
                      <RefreshCw className="w-4 h-4 mr-2" /> Regenerate Backup Codes
                    </Button>
                  </div>
                </div>
              )}

              {/* Disable: confirm with TOTP */}
              {securityPhase === 'disable' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#A1A1AA]">Enter your authenticator code to confirm disabling 2FA:</p>
                  <Input value={securityCode} onChange={e => setSecurityCode(e.target.value)} className="bg-[#09090B] border-[#27272A] text-white w-40 text-center tracking-widest" placeholder="000000" maxLength={6} />
                  <div className="flex gap-3">
                    <Button onClick={handle2FADisable} disabled={securityLoading || !securityCode} className="bg-red-600 hover:bg-red-700 text-white font-body text-sm">
                      {securityLoading ? 'Disabling...' : 'Confirm Disable'}
                    </Button>
                    <Button variant="outline" onClick={() => { setSecurityPhase('idle'); setSecurityCode(''); }} className="border-[#27272A] text-white hover:bg-[#27272A] font-body text-sm">Cancel</Button>
                  </div>
                </div>
              )}

              {/* Regenerate backup codes: confirm with TOTP */}
              {securityPhase === 'regen_confirm' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#A1A1AA]">Enter your authenticator code to regenerate backup codes:</p>
                  <Input value={securityCode} onChange={e => setSecurityCode(e.target.value)} className="bg-[#09090B] border-[#27272A] text-white w-40 text-center tracking-widest" placeholder="000000" maxLength={6} />
                  <div className="flex gap-3">
                    <Button onClick={handle2FARegenBackup} disabled={securityLoading || !securityCode} className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body text-sm">
                      {securityLoading ? 'Generating...' : 'Generate New Codes'}
                    </Button>
                    <Button variant="outline" onClick={() => { setSecurityPhase('idle'); setSecurityCode(''); }} className="border-[#27272A] text-white hover:bg-[#27272A] font-body text-sm">Cancel</Button>
                  </div>
                </div>
              )}

              {/* Show newly generated backup codes */}
              {securityPhase === 'regen' && backupCodes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400 text-xs">
                    <CheckCircle2 className="w-4 h-4" /> New backup codes generated — save them now
                  </div>
                  <div className="grid grid-cols-2 gap-1 bg-[#09090B] rounded p-3">
                    {backupCodes.map((c, i) => <code key={i} className="text-xs text-white font-mono">{c}</code>)}
                  </div>
                  <Button onClick={() => { setSecurityPhase('idle'); setBackupCodes([]); }} className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body text-sm">Done</Button>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Product Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[520px] bg-[#18181B] border-[#27272A] text-white max-h-[90vh] overflow-y-auto" data-testid="product-modal">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-[#D4AF37]">
              {editId ? 'Edit Product' : 'New Product'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[#A1A1AA] text-xs">Name *</Label>
              <Input data-testid="product-name-input" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="bg-[#09090B] border-[#27272A] text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#A1A1AA] text-xs">Description</Label>
              <Input data-testid="product-desc-input" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} className="bg-[#09090B] border-[#27272A] text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[#A1A1AA] text-xs">Price (EUR) *</Label>
                <Input data-testid="product-price-input" type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))} className="bg-[#09090B] border-[#27272A] text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#A1A1AA] text-xs">Stock Quantity</Label>
                <Input data-testid="product-stock-input" type="number" value={form.stock} onChange={e => setForm(p => ({...p, stock: e.target.value}))} className="bg-[#09090B] border-[#27272A] text-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#A1A1AA] text-xs">Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({...p, category: v}))}>
                <SelectTrigger data-testid="product-category-select" className="bg-[#09090B] border-[#27272A] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181B] border-[#27272A]">
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="text-white hover:bg-[#27272A]">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image Upload */}
            <div className="space-y-1.5">
              <Label className="text-[#A1A1AA] text-xs">Product Image</Label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    data-testid="product-image-input"
                    value={form.image_url}
                    onChange={e => setForm(p => ({...p, image_url: e.target.value}))}
                    className="bg-[#09090B] border-[#27272A] text-white"
                    placeholder="Image URL or upload below"
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  data-testid="upload-image-btn"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  variant="outline"
                  className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 font-body text-xs shrink-0"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Upload className="w-4 h-4 mr-1" />Upload</>
                  )}
                </Button>
              </div>
              {form.image_url && (
                <div className="mt-2 relative w-20 h-24 rounded-md overflow-hidden border border-[#27272A]">
                  <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button data-testid="save-product-btn" onClick={handleSave} disabled={saving} className="flex-1 bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body">
                <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button data-testid="cancel-product-btn" variant="outline" onClick={() => setModalOpen(false)} className="border-[#27272A] text-white hover:bg-[#27272A] font-body">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
