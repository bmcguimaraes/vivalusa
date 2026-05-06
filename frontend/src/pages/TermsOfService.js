import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
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

        <h1 className="font-heading text-3xl sm:text-4xl text-white mb-2 tracking-tight">Terms of Service</h1>
        <p className="text-[#A1A1AA] text-sm font-body mb-10">Last updated: 3 May 2026</p>

        <div className="space-y-8 font-body text-[#A1A1AA] text-sm leading-relaxed">

          <section>
            <h2 className="font-heading text-lg text-white mb-3">1. About VivaLusa</h2>
            <p>
              These Terms of Service govern your use of the VivaLusa website and your purchase of products from us. VivaLusa is operated from Sanguedo, Portugal. By using this site you agree to these terms.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">2. Eligibility</h2>
            <p>
              You must be at least 18 years old to place an order. By completing a purchase you confirm that you meet this requirement.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">3. Orders and Pricing</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>All prices are displayed in euros (EUR) by default and include applicable VAT where required</li>
              <li>Prices may be shown in other currencies for convenience; the charge will be made in EUR at the rate applicable at the time of payment</li>
              <li>We reserve the right to refuse or cancel any order, for example in the event of a pricing error or stock unavailability</li>
              <li>A contract between you and VivaLusa is formed only when you receive an order confirmation email</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">4. Payment</h2>
            <p>
              We accept payment via Stripe (credit/debit card) and PayPal. All transactions are encrypted. We do not store card details — these are processed directly by Stripe and PayPal under their own terms and security standards.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">5. Shipping</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Orders are dispatched from Sanguedo, Portugal</li>
              <li>Estimated delivery times are provided at checkout and are indicative only</li>
              <li>Shipping costs depend on destination country and are shown before you confirm payment</li>
              <li>Risk of loss passes to you upon delivery to the carrier</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">6. Returns and Refunds</h2>
            <p>
              Please see our <a href="/refund-policy" className="text-[#D4AF37] hover:underline">Refund Policy</a> for full details on returns, exchanges, and refunds.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">7. Product Descriptions</h2>
            <p>
              We make every effort to display product colours, textures, and descriptions as accurately as possible. However, your screen's colour reproduction may vary. We do not warrant that product descriptions are error-free and reserve the right to correct any errors.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">8. Intellectual Property</h2>
            <p>
              All content on this website — including text, images, logos, and design — is the property of VivaLusa and may not be reproduced or used without written permission.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, VivaLusa is not liable for any indirect, incidental, or consequential damages arising from your use of the site or purchase of our products. Our total liability to you shall not exceed the amount paid for the relevant order.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">10. Governing Law</h2>
            <p>
              These terms are governed by the laws of Portugal. Any disputes shall be subject to the exclusive jurisdiction of the courts of Portugal, without prejudice to your rights as a consumer under the law of your country of residence within the EU.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">11. Contact</h2>
            <p>
              For any questions regarding these terms, contact us at <a href="mailto:bxamazon123@gmail.com" className="text-[#D4AF37] hover:underline">bxamazon123@gmail.com</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
