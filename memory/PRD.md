# VivaLusa - Cosmetic E-Commerce PRD

## Original Problem Statement
Build a website to sell cosmetic products. Netflix-style landing page with product browsing by category, shopping cart, Stripe checkout, guest + member checkout (members get 5% off), zip-code shipping calculation, admin panel for product CRUD.

## Brand
- Name: VivaLusa
- Theme: Dark/Netflix-style, luxury aesthetic
- Colors: #09090B (bg), #D4AF37 (gold accent)
- Fonts: Cormorant Garamond (headings), Outfit (body)

## Architecture
- **Frontend**: React + Tailwind + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Payments**: Stripe (test key)
- **Auth**: JWT with httpOnly cookies
- **Storage**: Emergent Object Storage (product images)
- **Currency**: Live ECB rates via Frankfurter API (base EUR)

## What's Been Implemented

### Phase 1 - MVP (April 16, 2026)
- [x] Netflix-style landing page with hero + product rows by category
- [x] 6 seeded luxury cosmetic products (Skincare, Makeup, Fragrance)
- [x] Product detail pages
- [x] Shopping cart with slide-over drawer
- [x] User registration & login (JWT auth)
- [x] 5% member discount
- [x] Admin panel (CRUD products, view orders)
- [x] Stripe checkout integration
- [x] Zip-code based shipping calculator

### Phase 2 - Enhancements (April 16, 2026)
- [x] Shop page with search, category filters, sort
- [x] Order history page for logged-in users
- [x] Mobile responsive improvements
- [x] Navbar user dropdown with Orders link

### Phase 3 - Admin & Currency (April 16, 2026)
- [x] Multi-currency support (EUR default, 15 currencies)
- [x] Live exchange rates from ECB via Frankfurter API
- [x] Currency selector in navbar, persisted in localStorage
- [x] Admin product image upload via object storage
- [x] Admin Sales & Stock analytics tab (revenue, orders, stock by category, inventory table)
- [x] Low stock alerts in admin

## Prioritized Backlog
### P0 (Critical)
- [ ] PayPal integration (user will provide keys)

### P1 (High)
- [ ] Email order confirmations (Resend/SendGrid)
  - Include "Refer a Friend 10% off" unique link
  - Both referrer and referred friend get 10% off
- [ ] Referral discount system backend (generate codes, track usage, apply discounts)

### P2 (Nice to Have)
- [ ] Customer reviews/ratings
- [ ] Wishlist
- [ ] Inventory management alerts (email when stock low)
- [ ] Analytics dashboard charts (revenue over time)
