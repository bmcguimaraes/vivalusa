import React from 'react';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, subtotal, totalItems } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const discount = user ? subtotal * 0.05 : 0;
  const total = subtotal - discount;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="cart-backdrop"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div data-testid="cart-drawer" className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md animate-slide-in">
        <div className="h-full flex flex-col bg-[#0F0F11]/95 backdrop-blur-2xl border-l border-white/10">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="font-heading text-lg text-white">Your Cart ({totalItems})</h2>
            </div>
            <button data-testid="close-cart-btn" onClick={() => setIsOpen(false)} className="p-1.5 text-[#A1A1AA] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items */}
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <ShoppingBag className="w-12 h-12 text-[#27272A] mb-4" />
              <p className="font-body text-[#A1A1AA] text-sm">Your cart is empty</p>
              <p className="font-body text-[#3F3F46] text-xs mt-1">Discover our luxury collection</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="px-6 py-4 space-y-4">
                {items.map((item) => (
                  <div key={item.product_id} data-testid={`cart-item-${item.product_id}`} className="flex gap-3 bg-[#18181B] rounded-lg p-3">
                    <img src={item.image_url} alt={item.name} className="w-16 h-20 object-cover rounded-md" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-body text-sm text-white truncate">{item.name}</h3>
                      <p className="font-body text-xs text-[#D4AF37] mt-0.5">${item.price.toFixed(2)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          data-testid={`qty-minus-${item.product_id}`}
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          className="w-6 h-6 rounded bg-[#27272A] flex items-center justify-center text-white hover:bg-[#3F3F46] transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-body text-white w-6 text-center">{item.quantity}</span>
                        <button
                          data-testid={`qty-plus-${item.product_id}`}
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="w-6 h-6 rounded bg-[#27272A] flex items-center justify-center text-white hover:bg-[#3F3F46] transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <button
                        data-testid={`remove-item-${item.product_id}`}
                        onClick={() => removeItem(item.product_id)}
                        className="text-[#A1A1AA] hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-body text-white">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-6 py-4 border-t border-white/10 space-y-3">
              <div className="flex justify-between text-sm font-body">
                <span className="text-[#A1A1AA]">Subtotal</span>
                <span className="text-white">${subtotal.toFixed(2)}</span>
              </div>
              {user && discount > 0 && (
                <div className="flex justify-between text-sm font-body">
                  <span className="text-[#D4AF37]">Member Discount (5%)</span>
                  <span className="text-[#D4AF37]">-${discount.toFixed(2)}</span>
                </div>
              )}
              {!user && (
                <p className="text-xs text-[#A1A1AA] text-center">Sign in to save 5% on your order</p>
              )}
              <div className="flex justify-between text-base font-body font-medium">
                <span className="text-white">Total</span>
                <span className="text-[#D4AF37]">${total.toFixed(2)}</span>
              </div>
              <Button
                data-testid="checkout-btn"
                onClick={() => { setIsOpen(false); navigate('/checkout'); }}
                className="w-full bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body font-medium h-11"
              >
                Proceed to Checkout
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
