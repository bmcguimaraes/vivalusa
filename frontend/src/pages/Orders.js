import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Orders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      axios.get(`${API}/orders`, { withCredentials: true })
        .then(res => setOrders(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="orders-page" className="min-h-screen pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-[800px] mx-auto">
        <button
          data-testid="orders-back-btn"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-[#A1A1AA] hover:text-white text-sm font-body mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Store
        </button>

        <h1 className="font-heading text-3xl sm:text-4xl text-white mb-8 tracking-tight">My Orders</h1>

        {orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-[#27272A] mx-auto mb-4" />
            <p className="font-body text-[#A1A1AA] mb-2">No orders yet</p>
            <p className="font-body text-xs text-[#3F3F46] mb-6">Start shopping to see your orders here</p>
            <Button
              data-testid="start-shopping-btn"
              onClick={() => navigate('/')}
              className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body"
            >
              Browse Products
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                data-testid={`order-${order.id}`}
                className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden"
              >
                {/* Order Header */}
                <button
                  data-testid={`order-toggle-${order.id}`}
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#1C1C1F] transition-colors"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="text-sm font-body text-white">Order #{order.id?.slice(0, 8)}</p>
                      <p className="text-xs font-body text-[#A1A1AA]">
                        {order.items?.length || 0} item(s) &middot; {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-body text-[#D4AF37] font-medium">${order.total?.toFixed(2)}</p>
                      <span className={`text-[10px] font-body px-2 py-0.5 rounded-full ${
                        order.status === 'confirmed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    {expanded === order.id ? <ChevronUp className="w-4 h-4 text-[#A1A1AA]" /> : <ChevronDown className="w-4 h-4 text-[#A1A1AA]" />}
                  </div>
                </button>

                {/* Order Details (expanded) */}
                {expanded === order.id && (
                  <div className="px-5 pb-5 border-t border-[#27272A]">
                    <div className="pt-4 space-y-3">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <img src={item.image_url} alt={item.name} className="w-12 h-14 object-cover rounded-md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-body text-white truncate">{item.name}</p>
                            <p className="text-xs font-body text-[#A1A1AA]">Qty: {item.quantity} x ${item.price?.toFixed(2)}</p>
                          </div>
                          <span className="text-sm font-body text-white">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#27272A] space-y-1.5 text-sm font-body">
                      <div className="flex justify-between">
                        <span className="text-[#A1A1AA]">Subtotal</span>
                        <span className="text-white">${order.subtotal?.toFixed(2)}</span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#D4AF37]">Member Discount</span>
                          <span className="text-[#D4AF37]">-${order.discount?.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#A1A1AA]">Shipping</span>
                        <span className="text-white">${order.shipping_cost?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-medium pt-1 border-t border-[#27272A]">
                        <span className="text-white">Total</span>
                        <span className="text-[#D4AF37]">${order.total?.toFixed(2)}</span>
                      </div>
                    </div>

                    {order.shipping_address && (
                      <div className="mt-4 pt-3 border-t border-[#27272A]">
                        <p className="text-xs font-body text-[#A1A1AA] mb-1">Shipped to</p>
                        <p className="text-sm font-body text-white">
                          {order.shipping_address.full_name && `${order.shipping_address.full_name}, `}
                          {order.shipping_address.address && `${order.shipping_address.address}, `}
                          {order.shipping_address.city} {order.shipping_address.zip_code}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
