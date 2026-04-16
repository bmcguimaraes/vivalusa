import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles } from 'lucide-react';

export default function AuthModal({ open, onClose }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    let result;
    if (mode === 'login') {
      result = await login(email, password);
    } else {
      result = await register(name, email, password);
    }
    setLoading(false);
    if (result.success) {
      onClose();
      setName(''); setEmail(''); setPassword('');
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] bg-[#18181B] border-[#27272A] text-white" data-testid="auth-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-center text-[#D4AF37]">
            {mode === 'login' ? 'Welcome Back' : 'Join VivaLusa'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'register' && (
          <div className="flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-md px-3 py-2 mb-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <p className="text-xs text-[#D4AF37]">Members get an instant 5% off every order!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[#A1A1AA] text-xs">Full Name</Label>
              <Input
                id="name"
                data-testid="auth-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-[#09090B] border-[#27272A] text-white placeholder:text-[#3F3F46]"
                placeholder="Your name"
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[#A1A1AA] text-xs">Email</Label>
            <Input
              id="email"
              type="email"
              data-testid="auth-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#09090B] border-[#27272A] text-white placeholder:text-[#3F3F46]"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[#A1A1AA] text-xs">Password</Label>
            <Input
              id="password"
              type="password"
              data-testid="auth-password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#09090B] border-[#27272A] text-white placeholder:text-[#3F3F46]"
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </div>

          {error && <p data-testid="auth-error" className="text-sm text-red-400">{error}</p>}

          <Button
            type="submit"
            data-testid="auth-submit-btn"
            disabled={loading}
            className="w-full bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body font-medium"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-xs text-[#A1A1AA]">
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button
            data-testid="auth-toggle-mode"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-[#D4AF37] hover:underline"
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
