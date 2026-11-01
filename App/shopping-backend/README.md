# SOLE Skincare — Backend & Admin Portal Documentation

This backend implements a production-grade security foundation, authentication architecture, and administrative product & order management system for the **SOLE** luxury skincare application.

---

## 1. Quick Start & Setup

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB Atlas cluster or local MongoDB instance

### Installation
```bash
# Backend dependencies
cd App/shopping-backend
npm install

# Frontend dependencies
cd ../shopping-frontend
npm install
```

### Environment Configuration
Copy `.env.example` to `.env` in `App/shopping-backend/`:
```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Backend listening port | `5000` |
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` |
| `MONGO_URI` | MongoDB Atlas Connection URI | `mongodb+srv://...` |
| `JWT_ACCESS_SECRET` | Secret key for signing access tokens (min 32 chars) | Generated 64-char hex string |
| `JWT_REFRESH_SECRET`| Secret key for signing refresh tokens (min 32 chars) | Generated 64-char hex string |
| `JWT_ACCESS_EXPIRY` | Short-lived access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRY_DAYS` | Rotated refresh token lifespan | `7` |
| `CORS_ORIGIN` | Comma-separated allowed origins | `http://localhost:5173,http://localhost:3000` |
| `BCRYPT_SALT_ROUNDS` | Cost factor for password hashing | `12` |
| `BODY_LIMIT` | Maximum JSON request body size | `10kb` |

### Starting the Applications
```bash
# Start backend server (runs on http://localhost:5000)
cd App/shopping-backend
npm run dev

# In a separate terminal, start frontend (runs on http://localhost:5173)
cd App/shopping-frontend
npm run dev
```

---

## 2. Admin Account Provisioning

Administrative accounts cannot be created via public registration or API parameter injection. Initial administrator setup is handled via an idempotent, controlled provisioning script.

### Running Provisioning:
```bash
cd App/shopping-backend
npm run provision:admin
```

The script supports three modes:

1. **Interactive Prompt**:
   ```bash
   node scripts/provisionAdmin.js
   # Prompts for Email, Username, Password (hidden input in TTY), and Age
   ```

2. **CLI Flags**:
   ```bash
   node scripts/provisionAdmin.js --email=admin@sole-skincare.com --username="SOLE Admin" --password=YourSecurePassword123!
   ```

3. **Environment Variables**:
   ```bash
   ADMIN_EMAIL=admin@sole-skincare.com ADMIN_PASSWORD=YourSecurePassword123! ADMIN_USERNAME="SOLE Admin" node scripts/provisionAdmin.js
   ```

### Provisioning Security Guarantees:
- **Idempotent**: Safely checks whether the account already exists. If an administrator account already exists with that email, it safely exits without making duplicate entries.
- **Bcrypt Hashing**: Passwords are automatically hashed with 12 salt rounds before storage.
- **Zero Secret Exposure**: Plaintext passwords, hashes, and tokens are never printed to console logs or written to disk.
- **Role Isolation**: Grants `role: 'admin'` and verifies email status.

---

## 3. Frontend Admin URLs

| Page | URL | Description |
|---|---|---|
| **Admin Login** | `http://localhost:5173/admin/login` | Dedicated admin sign-in with server-side role check |
| **Admin Dashboard** | `http://localhost:5173/admin/dashboard` | KPI analytics, inventory alerts, quick actions |
| **Manage Products** | `http://localhost:5173/admin/products` | Search, filter, stock badges, edit & deactivation |
| **Add Product** | `http://localhost:5173/admin/products/new` | Product creation form with live storefront preview |
| **Edit Product** | `http://localhost:5173/admin/products/edit/:id` | Update pricing, inventory, botanicals, active status |
| **Customer Orders** | `http://localhost:5173/admin/orders` | Customer order ledger, totals, item breakdowns |

> **Note:** All `/admin/*` routes (except `/admin/login`) are protected by `<ProtectedRoute adminOnly>`. Unauthorized customers attempting to open admin routes receive an explicit `403 Access Forbidden` screen and are blocked from executing backend actions.

---

## 4. Admin API Endpoint Documentation

All administrative endpoints require a valid JWT access token with `role: 'admin'`.

### Product Management

- **`GET /api/admin/products`**
  - **Query Params**: `search`, `category`, `status` (`all` \| `active` \| `inactive`), `sortBy` (`name-asc`, `name-desc`, `price-asc`, `price-desc`, `stock-asc`, `stock-desc`), `page`, `limit`
  - **Response**: `{ products, total, totalAll, totalActive, totalInactive, totalLowStock, totalOutOfStock, page, totalPages }`

- **`POST /api/admin/products`** (Also available via `POST /api/products`)
  - **Validation**: Strict allowlist (`productName`, `subtitle`, `productPrice`, `originalPrice`, `category`, `size`, `quantity`, `description`, `howToUse`, `ingredients`, `image`, `isActive`).
  - **Constraints**: Rejects negative prices, negative quantities, and unallowlisted fields.
  - **Status Code**: `201 Created`

- **`GET /api/admin/products/:id`**
  - **Params**: Valid MongoDB `id` (validated with Zod).
  - **Returns**: Product document, including deactivated products.

- **`PATCH /api/admin/products/:id`**
  - **Validation**: Strict allowlist of editable fields. Mass-assignment protected.
  - **Status Code**: `200 OK`

- **`DELETE /api/admin/products/:id`**
  - **Safe Deactivation**: Sets `isActive: false` (soft-delete) to guarantee database integrity with customer purchase history.
  - **Permanent Deletion Protection**: If `?permanent=true` is requested, checks if the product is present in any existing orders. If referenced in historical orders, refuses hard deletion with `409 Conflict` and deactivates instead.
  - **Status Code**: `200 OK`

- **`POST /api/admin/products/:id/reactivate`**
  - Restores a deactivated product back to active status (`isActive: true`).

### Store Operations & Analytics

- **`GET /api/admin/stats`**
  - Returns store metrics: `totalProducts`, `activeProducts`, `inactiveProducts`, `lowStockProducts` (<= 5), `outOfStockProducts` (0), `totalOrders`, `totalUsers`, `totalRevenue`.

- **`GET /api/admin/orders`**
  - Lists all store orders populated with customer profile data (`username`, `emailId`).

- **`GET /api/admin/users`**
  - Lists registered users (passwords and verification tokens stripped).

---

## 5. Security Architecture & Assumptions

1. **Role Enforcement**:
   - `customer` role is strictly enforced on `POST /api/users`. Registration payloads containing `role: 'admin'` are rejected.
   - User profile update (`PUT /api/users/me`) only allows updating `username` and `age`. Role cannot be modified by the user.

2. **Dual-Token Storage**:
   - Short-lived Access Tokens (15 min) reside strictly in-memory in the React frontend (`AuthContext`), never in `localStorage` or `sessionStorage`.
   - Long-lived Refresh Tokens (7 days) are stored in `HttpOnly`, `SameSite=Lax` cookies, protected against XSS attacks.
   - Automatic refresh token rotation and token family reuse detection mitigate token hijacking.

3. **Database Integrity & Safe Deactivation**:
   - Products are soft-deactivated (`isActive: false`).
   - Public customer catalog (`GET /api/products`) filters out deactivated items (`isActive: { $ne: false }`), while existing orders retain valid foreign-key links to `Product` documents.

4. **Input Hygiene**:
   - Strict Zod validation schemas validate all inputs.
   - Recursive NoSQL injection sanitizers strip query operator symbols (`$`, `.`).
   - Image URLs are verified using `sanitizeImageUrl` before rendering to prevent malicious pseudo-protocols.

---

## 6. Testing Instructions

### Run Backend Tests:
```bash
cd App/shopping-backend
npm test
```
*Executes all 30 automated integration and unit tests against an isolated in-memory test database, guaranteeing zero destructive operations against MongoDB Atlas.*

### Run Frontend Tests:
```bash
cd App/shopping-frontend
npm test
```
*Validates input sanitization, open-redirect prevention, and error message masking.*

### Run Production Build:
```bash
cd App/shopping-frontend
npm run build
```
*Validates that all JSX, styling, and dependencies compile cleanly.*

---

## 7. Known Limitations

- **Mock Email Dispatch**: Password reset and email verification tokens are currently dispatched via server mock logs (`[AUTH-EMAIL-DISPATCH]`). In production environments, replace with AWS SES or SendGrid.
- **Image Hosting**: Product image URLs currently accept valid HTTP/HTTPS URLs and base64 URIs. Direct binary file upload to cloud storage (e.g. AWS S3 or Cloudinary) can be plugged in when cloud bucket credentials are configured.
