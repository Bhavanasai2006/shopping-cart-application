# Shopping Backend - Security & Authentication Architecture

This backend implements a production-grade security foundation and authentication architecture for the Shopping Cart Application.

## Key Security Features

### 1. Authentication & Session Management
- **Password Hashing**: Bcrypt with OWASP-recommended cost factor (salt rounds = 12 in production, 4 in test).
- **Dual-Token Architecture**:
  - **Access Tokens**: Short-lived (15 minutes), signed with `JWT_ACCESS_SECRET` using `HS256`. Payload contains `id`, `username`, `emailId`, and `role`.
  - **Refresh Tokens**: Long-lived (7 days), stored in MongoDB as SHA-256 hashes (`tokenHash`), grouped by `family` ID.
  - **Token Rotation**: Every refresh generates a new refresh token and invalidates the previous one (`isRevoked: true`).
  - **Token Reuse Detection**: If an already-revoked refresh token is re-submitted, the system flags token theft and immediately revokes all tokens within that family.
  - **HttpOnly Cookies**: Refresh and access tokens are delivered via `HttpOnly`, `SameSite=Lax`, and `Secure` (in production) cookies, mitigating XSS token theft.
  - **Bearer Token Support**: APIs support both `Authorization: Bearer <token>` and cookies for flexibility.

### 2. Authorization & RBAC
- **Roles**: `customer` (default) and `admin`.
- **Identity Derivation**: `POST /api/orders` derives user identity strictly from the verified JWT access token (`req.user._id`), never trusting client-supplied `userId`.
- **Object-Level Authorization (IDOR Prevention)**:
  - Customers can only view their own orders (`GET /api/orders`, `GET /api/orders/:id`).
  - Admins can manage products (`POST /api/products`) and inspect user accounts (`GET /api/admin/users`).

### 3. API Hardening & Injection Defense
- **Helmet**: Sets defensive HTTP response headers (CSP, X-Content-Type-Options, Frameguard, etc.).
- **Strict CORS**: Restricts access to allowlisted origins (`config.CORS_ORIGINS`) with `credentials: true`.
- **Payload Limits**: Request body size strictly capped (`10kb`) to prevent memory exhaustion DoS.
- **NoSQL Injection Defense**: Recursive sanitizer middleware strips all keys starting with `$` or containing `.`.
- **Input Validation (Zod)**: Schema validation across `body`, `query`, and `params` (strict allowlists for writable fields, regex format checks, and integer ranges).
- **Rate Limiting**:
  - Global limiter: 100 requests per 15 minutes.
  - Auth limiter: 10 attempts per 15 minutes on login, registration, and password reset endpoints.
- **Safe Error Handling**: Centralized error middleware normalizes errors, prevents stack trace exposure, and logs sanitized request payloads (redacting passwords and secrets).

---

## Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Backend listening port | `5000` |
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` |
| `MONGO_URI` | MongoDB Atlas Connection String | Configured in server |
| `JWT_ACCESS_SECRET` | Secret key for signing access tokens (min 32 chars) | Secure random string |
| `JWT_REFRESH_SECRET`| Secret key for refresh tokens | Secure random string |
| `JWT_ACCESS_EXPIRY` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRY_DAYS` | Refresh token lifespan | `7` |
| `CORS_ORIGIN` | Comma-separated list of allowed origins | `http://localhost:5173,http://localhost:3000` |
| `BCRYPT_SALT_ROUNDS` | Cost factor for password hashing | `12` |
| `BODY_LIMIT` | Maximum JSON request body size | `10kb` |

---

## API Endpoints

### Public Endpoints
- `GET /api/products`: Retrieve all products.
- `POST /api/users`: Register new customer account (`{ username, emailId, age, password }`).
- `POST /api/login`: Authenticate customer/admin (`{ emailId, password }`).
- `POST /api/auth/refresh`: Rotate refresh token to obtain a new access token.
- `POST /api/auth/logout`: Revoke active refresh token and clear cookies.
- `POST /api/auth/request-password-reset`: Request reset link/token.
- `POST /api/auth/reset-password`: Submit new password using reset token.
- `POST /api/auth/verify-email`: Verify account using email token.

### Customer Protected Endpoints (Requires valid access token)
- `GET /api/users/me` or `GET /api/auth/me`: View authenticated profile.
- `POST /api/orders`: Place order (Identity strictly derived from `req.user._id`).
- `GET /api/orders`: View user's own order history.
- `GET /api/orders/:id`: View specific order (Ownership checked).

### Admin Protected Endpoints (Requires `role: 'admin'`)
- `POST /api/products`: Create new product.
- `GET /api/admin/users`: View all users.

---

## Automated Test Suite

Run the isolated security tests:

```bash
npm test
```

The test suite runs against an isolated in-memory test database, guaranteeing zero destructive operations against MongoDB Atlas.

Covers:
1. Registration success & password hashing
2. Duplicate email handling (409 Conflict)
3. Input validation & unallowlisted field rejection
4. Login success & cookie/token delivery
5. Wrong credentials & timing attack mitigation
6. Missing, invalid, and expired tokens (401 Unauthorized)
7. Customer accessing admin endpoints (403 Forbidden)
8. NoSQL injection attack prevention
9. Request validation & malformed ObjectId handling
10. Rate limiting (429 Too Many Requests)
11. Sensitive field exposure & IDOR prevention
12. Refresh token rotation & reuse detection
13. Secure logout & cookie clearing
14. Password reset lifecycle
15. Email verification lifecycle
