import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';

export default function ProductCard({ product, gridMode }) {
  const [hovered, setHovered] = useState(false);
  const { addItem } = useCart();
  const { format } = useCurrency();
  const navigate = useNavigate();

  const handleAdd = (e) => {
    e.stopPropagation();
    addItem(product);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div
      data-testid={`product-card-${product.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/product/${product.id}`)}
      className={`relative cursor-pointer group ${gridMode ? 'w-full' : 'w-[180px] sm:w-[240px]'}`}
      style={{ transition: 'transform 0.3s ease', transform: hovered ? 'scale(1.03)' : 'scale(1)' }}
    >
      {/* Image Container - Poster ratio */}
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-[#18181B]">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500"
          style={{ transform: hovered ? 'scale(1.08)' : 'scale(1)' }}
          loading="lazy"
        />

        {/* Hover Overlay - always partially visible on mobile via touch */}
        <div
          className="absolute inset-0 flex flex-col justify-end p-3 sm:p-4 transition-opacity duration-300"
          style={{
            opacity: hovered ? 1 : 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)'
          }}
        >
          <p className="text-[10px] sm:text-xs text-[#D4AF37] font-body font-medium uppercase tracking-widest mb-1">{product.category}</p>
          <h3 className="font-heading text-sm sm:text-base font-semibold text-white leading-tight mb-1">{product.name}</h3>
          <p className="text-xs sm:text-sm text-[#A1A1AA] font-body line-clamp-2 mb-2 sm:mb-3 hidden sm:block">{product.description}</p>
          <div className="flex items-center justify-between">
            <span className="text-base sm:text-lg font-body font-medium text-[#D4AF37]">{format(product.price)}</span>
            <button
              data-testid={`add-to-cart-${product.id}`}
              onClick={handleAdd}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#D4AF37] hover:bg-[#B8962F] text-black rounded-md text-xs font-body font-medium transition-colors"
            >
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Add
            </button>
          </div>
        </div>

        {/* Mobile: Quick add button always visible */}
        <button
          data-testid={`mobile-add-${product.id}`}
          onClick={handleAdd}
          className="sm:hidden absolute bottom-2 right-2 w-8 h-8 rounded-full bg-[#D4AF37] flex items-center justify-center shadow-lg"
          style={{ opacity: hovered ? 0 : 1, transition: 'opacity 0.3s' }}
        >
          <Plus className="w-4 h-4 text-black" />
        </button>
      </div>

      {/* Below card: always visible info */}
      <div className="mt-2 px-1">
        <h3 className="font-body text-xs sm:text-sm text-white truncate">{product.name}</h3>
        <p className="font-body text-xs sm:text-sm text-[#D4AF37]">{format(product.price)}</p>
      </div>
    </div>
  );
}
