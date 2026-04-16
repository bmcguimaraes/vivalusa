import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Search, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Name: A-Z', value: 'name-asc' },
];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const query = searchParams.get('q') || '';
  const activeCategory = searchParams.get('category') || 'All';
  const sortBy = searchParams.get('sort') || 'newest';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          axios.get(`${API}/products`),
          axios.get(`${API}/products/categories`)
        ]);
        setProducts(prodRes.data);
        setCategories(catRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const updateParam = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'All' && value !== 'newest') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  const filtered = useMemo(() => {
    let result = [...products];

    // Filter by category
    if (activeCategory !== 'All') {
      result = result.filter(p => p.category === activeCategory);
    }

    // Search by name or description
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return result;
  }, [products, activeCategory, query, sortBy]);

  return (
    <div data-testid="shop-page" className="min-h-screen pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-tight mb-2">Shop</h1>
          <p className="font-body text-sm text-[#A1A1AA]">Browse our full luxury collection</p>
        </div>

        {/* Search + Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
            <Input
              data-testid="search-input"
              placeholder="Search products..."
              value={query}
              onChange={e => updateParam('q', e.target.value)}
              className="pl-10 bg-[#18181B] border-[#27272A] text-white placeholder:text-[#3F3F46] h-10"
            />
            {query && (
              <button
                data-testid="clear-search-btn"
                onClick={() => updateParam('q', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-testid="sort-btn"
                variant="outline"
                className="border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:bg-[#27272A] hover:text-white font-body text-sm h-10 shrink-0"
              >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                {SORT_OPTIONS.find(s => s.value === sortBy)?.label || 'Sort'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#18181B] border-[#27272A]">
              {SORT_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  data-testid={`sort-${opt.value}`}
                  onClick={() => updateParam('sort', opt.value)}
                  className={`text-sm font-body cursor-pointer ${sortBy === opt.value ? 'text-[#D4AF37]' : 'text-white'} hover:bg-[#27272A]`}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-2 mb-8 overflow-x-auto hide-scrollbar pb-1">
          {['All', ...categories].map(cat => (
            <button
              key={cat}
              data-testid={`filter-${cat.toLowerCase()}`}
              onClick={() => updateParam('category', cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-body whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-[#D4AF37] text-black font-medium'
                  : 'bg-[#18181B] text-[#A1A1AA] border border-[#27272A] hover:border-[#D4AF37]/30 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <p className="font-body text-xs text-[#A1A1AA] mb-4">
          {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
          {query && <span> for "<span className="text-white">{query}</span>"</span>}
          {activeCategory !== 'All' && <span> in <span className="text-[#D4AF37]">{activeCategory}</span></span>}
        </p>

        {/* Product Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-[#27272A] mx-auto mb-4" />
            <p className="font-body text-[#A1A1AA] mb-1">No products found</p>
            <p className="font-body text-xs text-[#3F3F46]">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product} gridMode />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
