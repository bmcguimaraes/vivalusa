import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function RefundPolicy() {
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

        <h1 className="font-heading text-3xl sm:text-4xl text-white mb-2 tracking-tight">Refund Policy</h1>
        <p className="text-[#A1A1AA] text-sm font-body mb-10">Last updated: 3 May 2026</p>

        <div className="space-y-8 font-body text-[#A1A1AA] text-sm leading-relaxed">

          <section>
            <h2 className="font-heading text-lg text-white mb-3">1. Your Right to Cancel (EU Consumers)</h2>
            <p>
              Under EU consumer law (Directive 2011/83/EU), you have the right to cancel your order within <span className="text-white font-medium">14 days</span> of receiving your goods, without giving any reason. To exercise this right, contact us at <a href="mailto:bxamazon123@gmail.com" className="text-[#D4AF37] hover:underline">bxamazon123@gmail.com</a> before the 14-day period expires.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">2. Conditions for Returns</h2>
            <p>To be eligible for a return, the following conditions must be met:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>The item must be unused, unopened, and in its original packaging</li>
              <li>You must contact us within 14 days of delivery</li>
              <li>Proof of purchase (order number or confirmation email) is required</li>
            </ul>
            <p className="mt-2">
              For hygiene reasons, we cannot accept returns on opened cosmetics, skincare, or fragrance products unless they are faulty or damaged.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">3. Faulty or Damaged Items</h2>
            <p>
              If you receive a product that is damaged, defective, or incorrect, please contact us within <span className="text-white font-medium">48 hours</span> of delivery at <a href="mailto:bxamazon123@gmail.com" className="text-[#D4AF37] hover:underline">bxamazon123@gmail.com</a> with a photo of the issue. We will arrange a replacement or full refund at no cost to you, including return shipping.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">4. How to Return an Item</h2>
            <ol className="list-decimal list-inside space-y-1">
              <li>Email <a href="mailto:bxamazon123@gmail.com" className="text-[#D4AF37] hover:underline">bxamazon123@gmail.com</a> with your order number and reason for return</li>
              <li>We will reply within 2 business days with return instructions</li>
              <li>Pack the item securely in its original packaging</li>
              <li>Ship to the address provided — we recommend using a tracked service</li>
            </ol>
            <p className="mt-2">
              Return shipping costs are the responsibility of the customer unless the item is faulty or incorrect.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">5. Refunds</h2>
            <p>
              Once we receive and inspect the returned item, we will notify you by email. If approved, your refund will be processed to your original payment method within <span className="text-white font-medium">5–10 business days</span>. The original shipping cost is non-refundable unless the return is due to our error.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">6. Exchanges</h2>
            <p>
              We do not process direct exchanges. If you would like a different product, please return the original item for a refund and place a new order.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg text-white mb-3">7. Contact</h2>
            <p>
              For any questions about returns or refunds, email us at <a href="mailto:bxamazon123@gmail.com" className="text-[#D4AF37] hover:underline">bxamazon123@gmail.com</a>. We aim to respond within 2 business days.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
