import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [status, setStatus] = useState('checking');
  const [paymentInfo, setPaymentInfo] = useState(null);
  const polledRef = useRef(false);

  useEffect(() => {
    if (!sessionId || polledRef.current) return;
    polledRef.current = true;

    const pollStatus = async (attempts = 0) => {
      const maxAttempts = 6;
      const interval = 2000;
      if (attempts >= maxAttempts) {
        setStatus('timeout');
        return;
      }
      try {
        const { data } = await axios.get(`${API}/checkout/status/${sessionId}`, { withCredentials: true });
        setPaymentInfo(data);
        if (data.payment_status === 'paid') {
          setStatus('success');
          clearCart();
          return;
        } else if (data.status === 'expired') {
          setStatus('expired');
          return;
        }
        setStatus('processing');
        setTimeout(() => pollStatus(attempts + 1), interval);
      } catch {
        setStatus('error');
      }
    };
    pollStatus();
  }, [sessionId, clearCart]);

  if (!sessionId) {
    return (
      <div className="min-h-screen pt-24 flex flex-col items-center justify-center px-6">
        <p className="text-white font-body">Invalid payment session.</p>
        <Button data-testid="go-home-btn" onClick={() => navigate('/')} className="mt-4 bg-[#D4AF37] hover:bg-[#B8962F] text-black">Go Home</Button>
      </div>
    );
  }

  return (
    <div data-testid="payment-success-page" className="min-h-screen pt-24 flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {(status === 'checking' || status === 'processing') && (
          <>
            <Loader2 className="w-16 h-16 text-[#D4AF37] mx-auto animate-spin mb-6" />
            <h1 className="font-heading text-2xl text-white mb-2">Processing Payment</h1>
            <p className="font-body text-sm text-[#A1A1AA]">Please wait while we confirm your payment...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="font-heading text-3xl text-white mb-2">Payment Successful!</h1>
            <p className="font-body text-sm text-[#A1A1AA] mb-6">Thank you for your order. Your items are on their way!</p>
            {paymentInfo && (
              <div className="bg-[#18181B] rounded-lg border border-[#27272A] p-4 mb-6 text-left">
                <div className="flex justify-between text-sm font-body mb-2">
                  <span className="text-[#A1A1AA]">Amount</span>
                  <span className="text-white">${(paymentInfo.amount_total / 100).toFixed(2)} {paymentInfo.currency?.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm font-body">
                  <span className="text-[#A1A1AA]">Status</span>
                  <span className="text-green-400">Confirmed</span>
                </div>
              </div>
            )}
            <Button data-testid="back-to-shop-success-btn" onClick={() => navigate('/')} className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body">
              <ShoppingBag className="w-4 h-4 mr-2" /> Continue Shopping
            </Button>
          </>
        )}

        {(status === 'error' || status === 'expired' || status === 'timeout') && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="font-heading text-2xl text-white mb-2">
              {status === 'timeout' ? 'Payment Status Unknown' : 'Payment Failed'}
            </h1>
            <p className="font-body text-sm text-[#A1A1AA] mb-6">
              {status === 'timeout'
                ? 'We could not confirm your payment. Please check your email for confirmation.'
                : 'Something went wrong. Please try again.'}
            </p>
            <Button data-testid="retry-btn" onClick={() => navigate('/checkout')} className="bg-[#D4AF37] hover:bg-[#B8962F] text-black font-body">
              Try Again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
