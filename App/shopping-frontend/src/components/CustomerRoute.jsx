import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * CustomerRoute Guard
 *
 * Enforces role-based boundary between customer storefront and administrative portal:
 * 1. Administrators (user.role === 'admin') are strictly forbidden from accessing
 *    the customer storefront, catalog, cart, wishlist, profile, or checkout.
 *    If an administrator navigates or types a customer route, they are immediately
 *    redirected to /admin/dashboard.
 * 2. Unauthenticated visitors can view public customer pages (catalog, product detail,
 *    cart, wishlist, login, register).
 * 3. Authenticated customer-only operations (profile, orders, checkout) require authentication;
 *    unauthenticated visitors are redirected to /login with attempted return location.
 */
function CustomerRoute({ children, requireAuth = false }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="sole-page-container">
        <div className="sole-loading-state" role="status" aria-live="polite">
          <div className="sole-spinner" aria-hidden="true"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Administrators MUST NOT access customer storefront routes
  if (isAuthenticated && user?.role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Protected customer routes requiring authentication (e.g. /profile, /orders, /checkout)
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default CustomerRoute;
