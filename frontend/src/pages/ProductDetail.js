import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ShoppingBag, Minus, Plus, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { format } = useCurrency();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    axios.get(`${API}/products/${id}`)
      .then(res => setProduct(res.data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const discountedPrice = user ? product.price * 0.95 : product.price;

  const handleAddToCart = () => {
    addItem(product, qty);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div data-testid="product-detail-page" className="min-h-screen pt-16">
      {/* Hero Image Section */}
      <div className="relative h-[50vh] sm:h-[65vh] overflow-hidden">
        <img
          src={product.image_url}
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 vignette-bottom" />

        {/* Back Button */}
        <button
          data-testid="back-btn"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 sm:top-6 sm:left-8 flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur-md rounded-md text-white text-sm hover:bg-black/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Product Info */}
      <div className="max-w-[1000px] mx-auto px-6 sm:px-8 -mt-20 relative z-10">
        <div className="bg-[#18181B]/80 backdrop-blur-xl rounded-xl border border-[#27272A] p-6 sm:p-10">
          <p className="text-xs font-body tracking-[0.2em] text-[#D4AF37] uppercase mb-2">{product.category}</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-3">{product.name}</h1>
          <p className="font-body text-sm sm:text-base text-[#A1A1AA] leading-relaxed mb-6 max-w-2xl">{product.description}</p>

          {/* Price */}
          <div className="flex items-center gap-3 mb-6">
            {user ? (
              <>
                <span className="font-body text-2xl font-medium text-[#D4AF37]">{format(discountedPrice)}</span>
                <span className="font-body text-lg text-[#A1A1AA] line-through">{format(product.price)}</span>
                <span className="px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded text-xs text-[#D4AF37] font-body">5% Member Discount</span>
              </>
            ) : (
              <span className="font-body text-2xl font-medium text-[#D4AF37]">{format(product.price)}</span>
            )}
          </div>

          {/* Quantity & Add to Cart */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2 bg-[#09090B] rounded-md border border-[#27272A] px-2">
              <button data-testid="detail-qty-minus" onClick={() => setQty(Math.max(1, qty - 1))} className="p-2 text-[#A1A1AA] hover:text-white transition-colors">
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-body text-sm text-white w-8 text-center">{qty}</span>
              <button data-testid="detail-qty-plus" onClick={() => setQty(qty + 1)} className="p-2 text-[#A1A1AA] hover:text-white transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <Button
              data-testid="detail-add-to-cart-btn"
              onClick={handleAddToCart}
              className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body font-medium px-8 h-11 rounded-md shadow-[0_0_20px_rgba(212,175,55,0.2)]"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
          </div>

          {/* Shipping Info */}
          <div className="flex items-center gap-2 text-[#A1A1AA] text-xs font-body">
            <Truck className="w-4 h-4" />
            <span>Free shipping calculated at checkout based on your location</span>
          </div>

          {/* Stock */}
          {product.stock < 20 && (
            <p className="mt-3 text-xs text-amber-400 font-body">Only {product.stock} left in stock</p>
          )}
        </div>
      </div>

      <div className="h-20" />
    </div>
  );
}
