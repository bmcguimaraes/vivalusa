import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from '@/components/ProductCard';

export default function ProductRow({ title, products, id }) {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  if (!products || products.length === 0) return null;

  return (
    <section id={id} data-testid={`product-row-${id}`} className="relative py-6 sm:py-8">
      <div className="px-4 sm:px-8 lg:px-12 mb-4">
        <h2 className="font-heading text-xl sm:text-2xl font-semibold text-white tracking-tight">{title}</h2>
      </div>

      <div className="group relative">
        {/* Scroll Buttons */}
        <button
          data-testid={`scroll-left-${id}`}
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-10 w-10 sm:w-12 flex items-center justify-center bg-gradient-to-r from-[#09090B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        <button
          data-testid={`scroll-right-${id}`}
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-10 w-10 sm:w-12 flex items-center justify-center bg-gradient-to-l from-[#09090B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>

        {/* Cards */}
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto hide-scrollbar snap-x snap-mandatory px-4 sm:px-8 lg:px-12 pb-2"
        >
          {products.map((product, i) => (
            <div key={product.id} className="snap-start shrink-0" style={{ animationDelay: `${i * 0.08}s` }}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
