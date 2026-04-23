import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductRow from '@/components/ProductRow';
import { useAuth } from '@/contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const HERO_BG = "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1920&q=85&auto=format&fit=crop";

const DEMO_PRODUCTS = [
  {
    id: "prod-001",
    name: "Radiance Gold Serum",
    description: "A luxurious 24K gold-infused face serum that delivers deep hydration and a luminous glow. Enriched with hyaluronic acid and vitamin C for visibly brighter, firmer skin.",
    price: 89.00,
    category: "Skincare",
    image_url: "https://images.unsplash.com/photo-1765053534710-2409e33e65b4?w=600&q=85&auto=format&fit=crop",
    stock: 50,
    featured: true,
  },
  {
    id: "prod-002",
    name: "Noir Velvet Lipstick",
    description: "An ultra-pigmented matte lipstick with a velvety smooth finish. Long-lasting wear with a deep, sultry burgundy shade that complements every skin tone.",
    price: 42.00,
    category: "Makeup",
    image_url: "https://images.unsplash.com/photo-1590785069862-343f908422d7?w=600&q=85&auto=format&fit=crop",
    stock: 120,
    featured: true,
  },
  {
    id: "prod-003",
    name: "Essence de Lusa",
    description: "A captivating signature fragrance blending warm amber, jasmine, and sandalwood. Inspired by golden Portuguese sunsets, this eau de parfum lingers beautifully all day.",
    price: 125.00,
    category: "Fragrance",
    image_url: "https://images.unsplash.com/photo-1774682060992-46c7e9f2e50b?w=600&q=85&auto=format&fit=crop",
    stock: 35,
    featured: true,
  },
  {
    id: "prod-004",
    name: "Midnight Eye Palette",
    description: "12 richly pigmented eyeshadow shades from shimmering golds to deep smoky blacks. Buildable, blendable, and designed for dramatic evening looks.",
    price: 58.00,
    category: "Makeup",
    image_url: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&q=85&auto=format&fit=crop",
    stock: 80,
    featured: false,
  },
  {
    id: "prod-005",
    name: "Golden Hour Moisturizer",
    description: "A rich, nourishing moisturizer infused with argan oil and shea butter. Delivers 72-hour hydration with a subtle golden shimmer for a dewy, radiant finish.",
    price: 65.00,
    category: "Skincare",
    image_url: "https://images.unsplash.com/photo-1775255487971-af15499994b1?w=600&q=85&auto=format&fit=crop",
    stock: 65,
    featured: false,
  },
  {
    id: "prod-006",
    name: "Lusitano Cologne",
    description: "A fresh, invigorating cologne with notes of bergamot, sea salt, and cedarwood. The perfect everyday scent that transitions seamlessly from day to night.",
    price: 95.00,
    category: "Fragrance",
    image_url: "https://images.unsplash.com/photo-1541643600914-78b084683702?w=600&q=85&auto=format&fit=crop",
    stock: 45,
    featured: false,
  },
  {
    id: "prod-007",
    name: "Black Pearl Cleanser",
    description: "A gentle yet deeply purifying foam cleanser with activated charcoal and pearl extract. Removes impurities without stripping the skin's natural moisture barrier.",
    price: 38.00,
    category: "Skincare",
    image_url: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600&q=85&auto=format&fit=crop",
    stock: 90,
    featured: false,
  },
  {
    id: "prod-008",
    name: "Sculpt & Define Palette",
    description: "A contour and highlight palette with six perfectly curated shades. Buildable pigment for a natural everyday look or a full sculpted finish.",
    price: 52.00,
    category: "Makeup",
    image_url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=85&auto=format&fit=crop",
    stock: 60,
    featured: false,
  },
  {
    id: "prod-009",
    name: "Rose Oud Elixir",
    description: "An opulent unisex fragrance weaving Bulgarian rose, oud wood, and musk. A statement scent for those who command presence.",
    price: 155.00,
    category: "Fragrance",
    image_url: "https://images.unsplash.com/photo-1547887538-047f0f5d5e01?w=600&q=85&auto=format&fit=crop",
    stock: 25,
    featured: true,
  },
];
const LIFESTYLE_IMG = "https://images.unsplash.com/photo-1775900047812-0d0b2f02e049?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwzfHx3b21hbiUyMGFwcGx5aW5nJTIwbWFrZXVwJTIwY2luZW1hdGljJTIwZGFya3xlbnwwfHx8fDE3NzYzNDM0OTR8MA&ixlib=rb-4.1.0&q=85";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

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
        setProducts(DEMO_PRODUCTS);
        setCategories([...new Set(DEMO_PRODUCTS.map(p => p.category))]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getProductsByCategory = (cat) => products.filter(p => p.category === cat);

  return (
    <div data-testid="home-page" className="min-h-screen">
      {/* Hero Section */}
      <section data-testid="hero-section" className="relative h-[85vh] sm:h-screen overflow-hidden">
        <img
          src={HERO_BG}
          alt="VivaLusa"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 vignette-bottom" />

        <div className="relative h-full flex flex-col justify-end px-6 sm:px-12 lg:px-16 pb-16 sm:pb-24 max-w-[1400px] mx-auto">
          <div className="max-w-xl">
            <p className="font-body text-xs sm:text-sm tracking-[0.3em] text-[#D4AF37] uppercase mb-3 animate-fade-in-up opacity-0">
              Luxury Beauty Collection
            </p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light text-white leading-[1.1] tracking-tight mb-4 animate-fade-in-up opacity-0 animate-delay-1">
              Discover Your
              <br />
              <span className="text-[#D4AF37] font-semibold">Radiance</span>
            </h1>
            <p className="font-body text-sm sm:text-base text-[#A1A1AA] leading-relaxed mb-6 max-w-md animate-fade-in-up opacity-0 animate-delay-2">
              Premium cosmetics crafted with the finest ingredients. Experience beauty that tells a story.
            </p>
            <div className="flex items-center gap-3 animate-fade-in-up opacity-0 animate-delay-3">
              <Button
                data-testid="hero-shop-btn"
                onClick={() => navigate('/shop')}
                className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body font-medium px-6 h-11 rounded-md shadow-[0_0_20px_rgba(212,175,55,0.2)]"
              >
                Shop Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {!user && (
                <span className="flex items-center gap-1.5 text-xs text-[#D4AF37]/80 font-body">
                  <Sparkles className="w-3.5 h-3.5" />
                  Members save 5%
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Product Rows by Category - Netflix style */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="py-8 sm:py-12 space-y-4">
          {categories.map((cat) => (
            <ProductRow
              key={cat}
              id={cat.toLowerCase()}
              title={cat}
              products={getProductsByCategory(cat)}
            />
          ))}
        </div>
      )}

      {/* Lifestyle Banner */}
      <section className="relative h-[50vh] sm:h-[60vh] overflow-hidden">
        <img src={LIFESTYLE_IMG} alt="Beauty lifestyle" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 vignette-overlay" />
        <div className="relative h-full flex flex-col justify-center items-center text-center px-6">
          <p className="font-body text-xs tracking-[0.3em] text-[#D4AF37] uppercase mb-3 animate-fade-in-up opacity-0">
            The VivaLusa Experience
          </p>
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight max-w-lg animate-fade-in-up opacity-0 animate-delay-1">
            Beauty Without Compromise
          </h2>
        </div>
      </section>

      {/* Footer */}
      <footer data-testid="footer" className="border-t border-[#27272A] py-8 sm:py-12 px-6 sm:px-12">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="font-heading text-lg text-[#D4AF37]">VivaLusa</span>
          <p className="font-body text-xs text-[#A1A1AA]">&copy; {new Date().getFullYear()} VivaLusa. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
