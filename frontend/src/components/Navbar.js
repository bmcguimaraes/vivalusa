import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, Search, Menu, X, LogOut, Shield, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import AuthModal from '@/components/AuthModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
              <Link to="/shop" className="text-sm font-body text-[#A1A1AA] hover:text-white transition-colors" data-testid="nav-shop">
                Shop
              </Link>
              <Link to="/shop?category=Skincare" className="text-sm font-body text-[#A1A1AA] hover:text-white transition-colors" data-testid="nav-skincare">
                Skincare
              </Link>
              <Link to="/shop?category=Makeup" className="text-sm font-body text-[#A1A1AA] hover:text-white transition-colors" data-testid="nav-makeup">
                Makeup
              </Link>
              <Link to="/shop?category=Fragrance" className="text-sm font-body text-[#A1A1AA] hover:text-white transition-colors" data-testid="nav-fragrance">
                Fragrance
              </Link>
            </div>

            {/* Right Icons */}
            <div className="flex items-center gap-2">
              <button
                data-testid="nav-search-btn"
                onClick={() => navigate('/shop')}
                className="p-2 text-[#A1A1AA] hover:text-white transition-colors"
                title="Search"
              >
                <Search className="w-5 h-5" />
              </button>

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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-testid="user-menu-btn"
                      className="flex items-center gap-1.5 p-2 text-[#A1A1AA] hover:text-white transition-colors"
                    >
                      <User className="w-5 h-5" />
                      <span className="hidden sm:block text-xs font-body max-w-[80px] truncate">{user.name || user.email}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#18181B] border-[#27272A] w-48">
                    <div className="px-3 py-2">
                      <p className="text-sm font-body text-white truncate">{user.name}</p>
                      <p className="text-xs font-body text-[#A1A1AA] truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator className="bg-[#27272A]" />
                    <DropdownMenuItem
                      data-testid="nav-orders-link"
                      onClick={() => navigate('/orders')}
                      className="text-sm font-body text-white hover:bg-[#27272A] cursor-pointer"
                    >
                      <Package className="w-4 h-4 mr-2" /> My Orders
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[#27272A]" />
                    <DropdownMenuItem
                      data-testid="logout-btn"
                      onClick={logout}
                      className="text-sm font-body text-red-400 hover:bg-[#27272A] cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
              <Link to="/" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A1A1AA] hover:text-white font-body">Home</Link>
              <Link to="/shop" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A1A1AA] hover:text-white font-body">Shop All</Link>
              <Link to="/shop?category=Skincare" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A1A1AA] hover:text-white font-body">Skincare</Link>
              <Link to="/shop?category=Makeup" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A1A1AA] hover:text-white font-body">Makeup</Link>
              <Link to="/shop?category=Fragrance" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A1A1AA] hover:text-white font-body">Fragrance</Link>
              {user && (
                <Link to="/orders" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A1A1AA] hover:text-white font-body">My Orders</Link>
              )}
              {user && user.role === 'admin' && (
                <Link to="/admin" onClick={() => setMobileOpen(false)} className="block text-sm text-[#D4AF37] hover:text-[#D4AF37]/80 font-body">Admin Panel</Link>
              )}
            </div>
          </div>
        )}
      </nav>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
