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

## User Personas
1. **Shopper (Guest)**: Browses, adds to cart, checks out as guest
2. **Member (Registered)**: Gets 5% discount, order history
3. **Admin**: Product CRUD, order management

## What's Been Implemented (April 16, 2026)
### Phase 1 - MVP
- [x] Netflix-style landing page with hero + product rows by category
- [x] 6 seeded luxury cosmetic products (Skincare, Makeup, Fragrance)
- [x] Product detail pages
- [x] Shopping cart (add/remove/quantity) with slide-over drawer
- [x] User registration & login (JWT auth)
- [x] 5% member discount
- [x] Admin panel (CRUD products, view orders)
- [x] Stripe checkout integration
- [x] Zip-code based shipping calculator
- [x] Payment success/failure pages with polling

### Phase 2 - Enhancements
- [x] Shop page with search bar, category filters, sort options
- [x] Order history page for logged-in users
- [x] Mobile responsive improvements (sticky checkout bar, mobile add buttons)
- [x] Navbar user dropdown with Orders link
- [x] Search icon in navbar

## Prioritized Backlog
### P0 (Critical)
- [ ] PayPal integration (user will provide keys)

### P1 (High)
- [ ] Email order confirmations (with "Refer a Friend 10% off" link)
- [ ] Referral discount system (both referrer and friend get 10% off)
- [ ] Product image upload in admin panel (object storage)

### P2 (Nice to Have)
- [ ] Customer reviews/ratings
- [ ] Wishlist
- [ ] Inventory management alerts
- [ ] Analytics dashboard for admin

## Next Tasks
1. PayPal integration (waiting for user credentials)
2. Email confirmations via Resend/SendGrid (user to choose provider)
   - Include "Refer a Friend" 10% discount code
   - Both referrer and referred friend get 10% off
3. Product image upload (object storage integration)
