import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Truck, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { format, currency } = useCurrency();

  const [form, setForm] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'US'
  });
  const [shipping, setShipping] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const discount = user ? subtotal * 0.05 : 0;
  const afterDiscount = subtotal - discount;
  const total = afterDiscount + (shipping?.shipping_cost || 0);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const calculateShipping = async () => {
    if (!form.zip_code || form.zip_code.length < 5) {
      toast.error('Please enter a valid zip code');
      return;
    }
    setShippingLoading(true);
    try {
      const { data } = await axios.post(`${API}/shipping/calculate`, { zip_code: form.zip_code });
      setShipping(data);
    } catch {
      toast.error('Failed to calculate shipping');
    } finally {
      setShippingLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!form.fullName || !form.email || !form.address || !form.city || !form.zip_code) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!shipping) {
      toast.error('Please calculate shipping first');
      return;
    }
    setCheckoutLoading(true);
    try {
      const { data } = await axios.post(`${API}/checkout/session`, {
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        shipping_address: {
          full_name: form.fullName,
          address: form.address,
          city: form.city,
          state: form.state,
          zip_code: form.zip_code,
          country: form.country
        },
        origin_url: window.location.origin,
        guest_email: !user ? form.email : null
      }, { withCredentials: true });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Checkout failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div data-testid="checkout-empty" className="min-h-screen pt-24 flex flex-col items-center justify-center px-6">
        <p className="font-heading text-2xl text-white mb-4">Your cart is empty</p>
        <Button data-testid="continue-shopping-btn" onClick={() => navigate('/')} className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body">
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="checkout-page" className="min-h-screen pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <button data-testid="back-to-shop-btn" onClick={() => navigate('/')} className="flex items-center gap-2 text-[#A1A1AA] hover:text-white text-sm font-body mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Continue Shopping
        </button>

        <h1 className="font-heading text-3xl sm:text-4xl text-white mb-8 tracking-tight">Checkout</h1>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Shipping Details */}
            <div className="bg-[#18181B] rounded-xl border border-[#27272A] p-6">
              <h2 className="font-heading text-lg text-white mb-4">Shipping Details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[#A1A1AA] text-xs">Full Name *</Label>
                  <Input data-testid="checkout-name" name="fullName" value={form.fullName} onChange={handleChange} className="bg-[#09090B] border-[#27272A] text-white" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#A1A1AA] text-xs">Email *</Label>
                  <Input data-testid="checkout-email" name="email" type="email" value={form.email} onChange={handleChange} className="bg-[#09090B] border-[#27272A] text-white" required />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-[#A1A1AA] text-xs">Address *</Label>
                  <Input data-testid="checkout-address" name="address" value={form.address} onChange={handleChange} className="bg-[#09090B] border-[#27272A] text-white" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#A1A1AA] text-xs">City *</Label>
                  <Input data-testid="checkout-city" name="city" value={form.city} onChange={handleChange} className="bg-[#09090B] border-[#27272A] text-white" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#A1A1AA] text-xs">State</Label>
                  <Input data-testid="checkout-state" name="state" value={form.state} onChange={handleChange} className="bg-[#09090B] border-[#27272A] text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#A1A1AA] text-xs">Zip Code *</Label>
                  <div className="flex gap-2">
                    <Input data-testid="checkout-zip" name="zip_code" value={form.zip_code} onChange={handleChange} className="bg-[#09090B] border-[#27272A] text-white" placeholder="e.g. 90210" required />
                    <Button
                      data-testid="calc-shipping-btn"
                      onClick={calculateShipping}
                      disabled={shippingLoading}
                      variant="outline"
                      className="shrink-0 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 font-body text-xs"
                    >
                      {shippingLoading ? '...' : 'Calculate'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#A1A1AA] text-xs">Country</Label>
                  <Input data-testid="checkout-country" name="country" value={form.country} onChange={handleChange} className="bg-[#09090B] border-[#27272A] text-white" />
                </div>
              </div>

              {shipping && (
                <div data-testid="shipping-result" className="mt-4 flex items-center gap-2 p-3 bg-[#09090B] rounded-lg border border-[#27272A]">
                  <Truck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <div className="text-sm font-body">
                    <span className="text-white">{format(shipping.shipping_cost)}</span>
                    <span className="text-[#A1A1AA] ml-2">Estimated: {shipping.estimate}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-[#18181B] rounded-xl border border-[#27272A] p-6 sticky top-20">
              <h2 className="font-heading text-lg text-white mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                {items.map(item => (
                  <div key={item.product_id} className="flex items-center gap-3">
                    <img src={item.image_url} alt={item.name} className="w-12 h-14 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-body truncate">{item.name}</p>
                      <p className="text-xs text-[#A1A1AA] font-body">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm text-white font-body">{format(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#27272A] pt-4 space-y-2">
                <div className="flex justify-between text-sm font-body">
                  <span className="text-[#A1A1AA]">Subtotal</span>
                  <span className="text-white">{format(subtotal)}</span>
                </div>
                {user && discount > 0 && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-[#D4AF37] flex items-center gap-1"><Sparkles className="w-3 h-3" />Member Discount</span>
                    <span className="text-[#D4AF37]">-{format(discount)}</span>
                  </div>
                )}
                {shipping && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-[#A1A1AA]">Shipping</span>
                    <span className="text-white">{format(shipping.shipping_cost)}</span>
                  </div>
                )}
                <div className="border-t border-[#27272A] pt-2 flex justify-between font-body font-medium">
                  <span className="text-white">Total</span>
                  <span className="text-[#D4AF37] text-lg">{format(total)}</span>
                </div>
              </div>

              {!user && (
                <p className="text-xs text-[#A1A1AA] text-center mt-3 flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                  Sign in to save 5% on your order
                </p>
              )}

              <Button
                data-testid="place-order-btn"
                onClick={handleCheckout}
                disabled={checkoutLoading || !shipping}
                className="w-full mt-4 bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body font-medium h-11"
              >
                {checkoutLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Pay {format(total)}
                  </span>
                )}
              </Button>

              <p className="text-center text-[10px] text-[#3F3F46] mt-3 font-body flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Secure payment via Stripe
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#18181B]/95 backdrop-blur-xl border-t border-[#27272A] px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-[#A1A1AA] font-body">Total</p>
          <p className="text-lg text-[#D4AF37] font-body font-medium">{format(total)}</p>
        </div>
        <Button
          data-testid="mobile-place-order-btn"
          onClick={handleCheckout}
          disabled={checkoutLoading || !shipping}
          className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body font-medium h-10 px-6"
        >
          {checkoutLoading ? 'Processing...' : (
            <span className="flex items-center gap-2"><Lock className="w-4 h-4" />Pay Now</span>
          )}
        </Button>
      </div>
    </div>
  );
}
