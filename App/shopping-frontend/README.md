# SOLE — Luxury Organic Skincare Frontend

A responsive e-commerce web application for **SOLE Organic Skincare**, built with React 19, Vite, and React Router v7. Features a warm earthy luxury aesthetic, cloud-synchronized shopping cart, real-time search & filters, JWT authentication, and security protections.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **Backend Service**: Running at `http://localhost:5000` (or configured via environment)

---

## Getting Started

### 1. Install Dependencies

```bash
cd App/shopping-frontend
npm install
```

### 2. Environment Configuration

Create or update `.env` in the `App/shopping-frontend` root directory:

```env
VITE_API_URL=http://localhost:5000/api
```

*(If omitted, the application defaults to `http://localhost:5000/api`)*

### 3. Start Development Server

```bash
npm run dev
```

The application will launch at `http://localhost:5173`.

### 4. Build for Production

```bash
npm run build
```

Production-ready assets are compiled into the `dist/` directory.

### 5. Run Frontend Security & Utility Tests

```bash
node --test src/utils/security.test.js
```

---

## Key Architecture & Features

### 1. Luxury Skincare Brand Experience (SOLE)
- **Warm Minimalist Aesthetic**: Custom color palette featuring soft cream backgrounds (`#FAF7F2`), warm sand surfaces (`#EDE5DC`), and rich espresso typography (`#1A1817`).
- **Amber Glass Bottle Visuals**: Vector illustrations for serums, creams, facial oils, toners, and masks.
- **Product Detail Modal & Page**: Multi-tab interface presenting *Description*, *How to Use*, and *Ingredients*.
- **Mobile-First UX**: Responsive product grids, bottom navigation bar on mobile viewports, and sticky checkout summaries.

### 2. Search, Filter & Discovery
- **Live Search**: Instant keyword filtering across product names, descriptions, and categories.
- **Category Filtering**: Quick filter chips for *Cleansers*, *Serums*, *Creams*, *Masks*, *Oils*, and *Sun Care*.
- **Price Range & Sorting**: Dual range sliders and sorting options (*Featured*, *Price: Low to High*, *Price: High to Low*, *Name A–Z*).
- **Client & Server Pagination**: Configurable items per page with clear page indicators.

### 3. Shopping Cart & Wishlist
- **Cloud-Synchronized Cart**: Fully synchronized with the backend REST cart API (`/api/cart`), persisting user carts across sessions and devices.
- **Authoritative Pricing**: Relies strictly on backend calculations for unit prices, subtotal, shipping, and discount amounts.
- **Local Fallback**: Graceful offline fallback for guest users before authentication.
- **Wishlist Management**: Persistent wishlist stored per user with instant toggle.

### 4. Authentication & Protected Routes
- **JWT Authentication**: Secure token handling with in-memory tokens and token refresh rotation.
- **Session Restoration**: Restores user sessions on reload without storing sensitive raw passwords.
- **Role-Based Guards**: Protected route wrappers (`ProtectedRoute.jsx`) preventing unauthorized views.
- **User Profile Management**: Live profile viewer with secure updates.

### 5. Frontend Security Measures
- **No Dangerous DOM Operations**: Strictly eliminates `eval()` and `dangerouslySetInnerHTML`.
- **URL & Navigation Sanitization**: Internal redirect paths are validated against open-redirect attacks (`sanitizeAppPath`).
- **Image URL Sanitization**: Enforces strict URL protocol safety (`sanitizeImageUrl`).
- **Safe Error Display**: Prevents credential leakage or sensitive trace exposure in UI messages (`sanitizeErrorMessage`).
- **Complete Logout Cleanup**: Guaranteed purging of auth tokens, user state, and temporary session keys upon sign-out.

### 6. User Experience & Accessibility
- **Toast Notifications**: Non-intrusive feedback for actions (cart add, remove, wishlist update, authentication alerts).
- **Skeleton Loaders**: Polished skeleton placeholders while product catalog or cart data is loading.
- **Accessible & Keyboard Friendly**: Semantic ARIA tags, proper labels, Escape key listeners for modals, and clear focus states.
- **Confirmation Dialogs**: Built-in confirmation modals for destructive operations like cart clearing.

---

## Project Structure

```
App/shopping-frontend/
├── public/                 # Static assets
├── src/
│   ├── assets/             # Brand icons & styles
│   ├── components/         # Reusable UI components
│   │   ├── BottomNav.jsx          # Mobile bottom navigation bar
│   │   ├── ConfirmModal.jsx       # Action confirmation dialogs
│   │   ├── Navbar.jsx             # Top desktop navigation header
│   │   ├── ProductDetailModal.jsx # Quick-view product modal
│   │   ├── ProductSkeleton.jsx    # Loading placeholder cards
│   │   ├── ProtectedRoute.jsx     # Route protection guard
│   │   └── SkincareImage.jsx      # Vector skincare product visuals
│   ├── context/            # React context providers
│   │   ├── AuthContext.jsx        # Authentication & session state
│   │   ├── CartContext.jsx        # Cart state & cloud synchronization
│   │   ├── ToastContext.jsx       # Global notification toasts
│   │   └── WishlistContext.jsx    # Wishlist state persistence
│   ├── pages/              # Application views
│   │   ├── AdminProducts.jsx      # Admin product management
│   │   ├── Cart.jsx               # Shopping cart & checkout breakdown
│   │   ├── Login.jsx              # Customer login
│   │   ├── Orders.jsx             # Order history
│   │   ├── ProductDetail.jsx      # Full-page product view
│   │   ├── Products.jsx           # Main skincare catalog & filters
│   │   ├── Profile.jsx            # User profile management
│   │   ├── Register.jsx           # Customer registration
│   │   └── Wishlist.jsx           # Saved items page
│   ├── utils/              # Security and sanitization utilities
│   │   ├── security.js            # Input, URL, and error sanitizers
│   │   └── security.test.js       # Security unit test suite
│   ├── api.js              # Centralized Axios client & interceptors
│   ├── App.css             # SOLE luxury styling & theme variables
│   ├── App.jsx             # Route definitions & layout wrappers
│   └── main.jsx            # Application entrypoint
├── index.html
├── package.json
├── vite.config.js
└── README.md
```
