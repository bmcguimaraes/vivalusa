import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductRow from '@/components/ProductRow';
import { useAuth } from '@/contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const HERO_BG = "https://static.prod-images.emergentagent.com/jobs/a578c59c-55b8-40a0-b078-ec23d806778b/images/7d357cbadf6daad38e379851ca6a35c23910c79dbcb9e007c4fb08f0c057c427.png";
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
        console.error('Failed to load products:', err);
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
