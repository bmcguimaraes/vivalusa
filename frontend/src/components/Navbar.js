import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, Search, Menu, X, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import AuthModal from '@/components/AuthModal';

const LOGO_URL = "https://static.prod-images.emergentagent.com/jobs/a578c59c-55b8-40a0-b078-ec23d806778b/images/8a1f1845869ff465ed3dbc4eb1821f06719d685c50eafefee05e9296c30ff53f.png";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { totalItems, setIsOpen } = useCart();
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <nav data-testid="main-navbar" className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 shrink-0" data-testid="logo-link">
              <img src={LOGO_URL} alt="VivaLusa" className="h-8 w-8 object-contain" />
              <span className="font-heading text-xl font-semibold tracking-tight text-[#D4AF37]">
                VivaLusa
              </span>
            </Link>

            {/* Center Links - Desktop */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-sm font-body text-[#A1A1AA] hover:text-white transition-colors" data-testid="nav-home">
                Home
              </Link>
              <Link to="/#skincare" className="text-sm font-body text-[#A1A1AA] hover:text-white transition-colors" data-testid="nav-skincare">
                Skincare
              </Link>
              <Link to="/#makeup" className="text-sm font-body text-[#A1A1AA] hover:text-white transition-colors" data-testid="nav-makeup">
                Makeup
              </Link>
              <Link to="/#fragrance" className="text-sm font-body text-[#A1A1AA] hover:text-white transition-colors" data-testid="nav-fragrance">
                Fragrance
              </Link>
            </div>

            {/* Right Icons */}
            <div className="flex items-center gap-3">
              {user && user.role === 'admin' && (
                <button
                  data-testid="admin-panel-btn"
                  onClick={() => navigate('/admin')}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-body text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </button>
              )}

              {user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:block text-xs text-[#A1A1AA] font-body">{user.name || user.email}</span>
                  <button
                    data-testid="logout-btn"
                    onClick={logout}
                    className="p-2 text-[#A1A1AA] hover:text-white transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  data-testid="login-btn"
                  onClick={() => setAuthOpen(true)}
                  className="p-2 text-[#A1A1AA] hover:text-white transition-colors"
                  title="Sign In"
                >
                  <User className="w-5 h-5" />
                </button>
              )}

              <button
                data-testid="cart-btn"
                onClick={() => setIsOpen(true)}
                className="relative p-2 text-[#A1A1AA] hover:text-white transition-colors"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#D4AF37] text-black text-[10px] font-semibold flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>

              <button
                data-testid="mobile-menu-btn"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 text-[#A1A1AA] hover:text-white transition-colors"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#09090B]/95 backdrop-blur-xl">
            <div className="px-4 py-4 space-y-3">
              <Link to="/" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A1A1AA] hover:text-white">Home</Link>
              <Link to="/#skincare" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A1A1AA] hover:text-white">Skincare</Link>
              <Link to="/#makeup" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A1A1AA] hover:text-white">Makeup</Link>
              <Link to="/#fragrance" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A1A1AA] hover:text-white">Fragrance</Link>
              {user && user.role === 'admin' && (
                <Link to="/admin" onClick={() => setMobileOpen(false)} className="block text-sm text-[#D4AF37] hover:text-[#D4AF37]/80">Admin Panel</Link>
              )}
            </div>
          </div>
        )}
      </nav>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
