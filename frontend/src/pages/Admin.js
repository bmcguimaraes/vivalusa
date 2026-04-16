import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Pencil, Trash2, ArrowLeft, Package, ShoppingBag, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = ['Skincare', 'Makeup', 'Fragrance', 'Haircare', 'Body'];

const emptyProduct = { name: '', description: '', price: '', category: 'Skincare', image_url: '', stock: '100', featured: false };

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('products');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, orderRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/admin/orders`, { withCredentials: true })
      ]);
      setProducts(prodRes.data);
      setOrders(orderRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyProduct);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      category: product.category,
      image_url: product.image_url,
      stock: String(product.stock),
      featured: product.featured || false
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.category) {
      toast.error('Name, price, and category are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        stock: parseInt(form.stock) || 100,
      };
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

  const handleDelete = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`${API}/admin/products/${productId}`, { withCredentials: true });
      toast.success('Product deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
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
        <div className="flex gap-1 mb-6 bg-[#18181B] rounded-lg p-1 w-fit">
          <button
            data-testid="tab-products"
            onClick={() => setTab('products')}
            className={`px-4 py-2 rounded-md text-sm font-body transition-colors ${tab === 'products' ? 'bg-[#D4AF37] text-black' : 'text-[#A1A1AA] hover:text-white'}`}
          >
            <Package className="w-4 h-4 inline mr-1.5" />Products ({products.length})
          </button>
          <button
            data-testid="tab-orders"
            onClick={() => setTab('orders')}
            className={`px-4 py-2 rounded-md text-sm font-body transition-colors ${tab === 'orders' ? 'bg-[#D4AF37] text-black' : 'text-[#A1A1AA] hover:text-white'}`}
          >
            <ShoppingBag className="w-4 h-4 inline mr-1.5" />Orders ({orders.length})
          </button>
        </div>

        {/* Products Tab */}
        {tab === 'products' && (
          <div className="grid gap-3">
            {products.map(p => (
              <div key={p.id} data-testid={`admin-product-${p.id}`} className="bg-[#18181B] border border-[#27272A] rounded-lg p-4 flex items-center gap-4">
                <img src={p.image_url} alt={p.name} className="w-14 h-18 object-cover rounded-md shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-body text-white truncate">{p.name}</h3>
                  <p className="text-xs text-[#A1A1AA] font-body">{p.category} &middot; Stock: {p.stock}</p>
                </div>
                <span className="text-sm font-body text-[#D4AF37] shrink-0">${p.price.toFixed(2)}</span>
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

        {/* Orders Tab */}
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
                    <span className="text-lg font-body text-[#D4AF37]">${o.total?.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Product Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-[#18181B] border-[#27272A] text-white" data-testid="product-modal">
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
                <Label className="text-[#A1A1AA] text-xs">Price ($) *</Label>
                <Input data-testid="product-price-input" type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))} className="bg-[#09090B] border-[#27272A] text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#A1A1AA] text-xs">Stock</Label>
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
            <div className="space-y-1.5">
              <Label className="text-[#A1A1AA] text-xs">Image URL</Label>
              <Input data-testid="product-image-input" value={form.image_url} onChange={e => setForm(p => ({...p, image_url: e.target.value}))} className="bg-[#09090B] border-[#27272A] text-white" placeholder="https://..." />
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
