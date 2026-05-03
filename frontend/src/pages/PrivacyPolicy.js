import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#A1A1AA] hover:text-white text-sm font-body mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="font-heading text-3xl sm:text-4xl text-white mb-2 tracking-tight">Privacy Policy</h1>
        <p className="text-[#A1A1AA] text-sm font-body mb-10">Last updated: 3 May 2026</p>

        <div className="space-y-8 font-body text-[#A1A1AA] text-sm leading-relaxed">

          <section>
            <h2 className="font-heading text-lg text-white mb-3">1. Who We Are</h2>
            <p>
              VivaLusa is a luxury cosmetics brand operated from Sanguedo, Portugal. For the purposes of the General Data Protection Regulation (GDPR), VivaLusa is the data controller of your personal information.
            </p>
            <p className="mt-2">Contact: <a href="mailto:privacy@vivalusa.com" className="text-[#D4AF37] hover:underline">privacy@vivalusa.com</a></p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">2. What Data We Collect</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><span className="text-white">Account data</span> — name, email address, hashed password</li>
              <li><span className="text-white">Order data</span> — shipping address, items purchased, payment reference (we do not store card details — these are handled by Stripe and PayPal)</li>
              <li><span className="text-white">Usage data</span> — pages visited, actions taken on the site, device and browser type (via PostHog analytics, only if you consent)</li>
              <li><span className="text-white">Communication data</span> — emails you send us</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">3. Why We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To process and fulfil your orders</li>
              <li>To send order confirmations and shipping updates</li>
              <li>To manage your account and authenticate you securely</li>
              <li>To improve our website and product offering (analytics, with consent only)</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">4. Legal Basis for Processing</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><span className="text-white">Contract</span> — processing your order requires your name, email, and shipping address</li>
              <li><span className="text-white">Legitimate interest</span> — fraud prevention and site security</li>
              <li><span className="text-white">Consent</span> — analytics cookies (you can withdraw at any time via the cookie banner)</li>
              <li><span className="text-white">Legal obligation</span> — retaining transaction records as required by Portuguese and EU law</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">5. Who We Share Data With</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><span className="text-white">Stripe</span> — payment processing (their privacy policy applies to card data)</li>
              <li><span className="text-white">PayPal</span> — alternative payment processing</li>
              <li><span className="text-white">Resend</span> — transactional email delivery</li>
              <li><span className="text-white">Cloudflare</span> — infrastructure and image hosting</li>
              <li><span className="text-white">PostHog</span> — analytics (only if you consent)</li>
            </ul>
            <p className="mt-2">We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">6. How Long We Keep Your Data</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Account data — until you request deletion</li>
              <li>Order records — 7 years (Portuguese fiscal law requirement)</li>
              <li>Analytics data — 12 months</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">7. Your Rights</h2>
            <p>Under GDPR, you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Object to or restrict processing</li>
              <li>Withdraw consent at any time (for analytics)</li>
              <li>Lodge a complaint with the CNPD (Portuguese data protection authority)</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, email us at <a href="mailto:privacy@vivalusa.com" className="text-[#D4AF37] hover:underline">privacy@vivalusa.com</a>.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">8. Cookies</h2>
            <p>
              We use a cookie consent banner to let you choose which cookies are active. Strictly necessary cookies (authentication, cart) are always active. Analytics cookies (PostHog) are only loaded after your explicit consent and can be withdrawn at any time by clearing your browser cookies.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">9. Data Security</h2>
            <p>
              Passwords are hashed and never stored in plain text. Authentication tokens are short-lived. All data in transit is encrypted via HTTPS. We use Sentry for error monitoring which may capture anonymised request metadata.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this policy occasionally. The date at the top of this page reflects the latest revision. Continued use of the site after changes constitutes acceptance.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
