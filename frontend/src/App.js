import React, { useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import CookieConsent, { useCookieConsent } from "@/components/CookieConsent";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import PaymentSuccess from "@/pages/PaymentSuccess";
import Admin from "@/pages/Admin";
import Orders from "@/pages/Orders";

const POSTHOG_KEY = "phc_xAvL2Iq4tFmANRE7kzbKwaSqp1HJjN7x48s3vr0CMjs";
const POSTHOG_HOST = "https://us.i.posthog.com";

function initPostHog() {
  if (window.__posthogLoaded) return;
  window.__posthogLoaded = true;
  !(function (t, e) {
    var o, n, p, r;
    e.__SV || ((window.posthog = e), (e._i = []), (e.init = function (i, s, a) {
      function g(t, e) { var o = e.split("."); 2 == o.length && ((t = t[o[0]]), (e = o[1])), (t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }); }
      ((p = t.createElement("script")).type = "text/javascript"), (p.crossOrigin = "anonymous"), (p.async = !0), (p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js"), (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
      var u = e; void 0 !== a ? (u = e[a] = []) : (a = "posthog"), (u.people = u.people || []), (u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e; }), (u.people.toString = function () { return u.toString(1) + ".people (stub)"; }), (o = "init capture identify setPersonProperties group reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording".split(" ")), (n = 0);
      for (; n < o.length; n++) g(u, o[n]);
      e._i.push([i, s, a]);
    }), (e.__SV = 1));
  })(document, window.posthog || []);
  window.posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    session_recording: { recordCrossOriginIframes: true, capturePerformance: false },
  });
}

function App() {
  const existingConsent = useCookieConsent();

  // Boot PostHog immediately if the user already accepted analytics
  React.useEffect(() => {
    if (existingConsent?.analytics) initPostHog();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConsent = useCallback((consent) => {
    if (consent.analytics) initPostHog();
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <CurrencyProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-[#09090B]">
              <Navbar />
              <CartDrawer />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/cart" element={<Checkout />} />
                <Route path="/payment/success" element={<PaymentSuccess />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </div>
            <Toaster richColors position="bottom-right" />
            <CookieConsent onConsent={handleConsent} />
          </BrowserRouter>
        </CurrencyProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
