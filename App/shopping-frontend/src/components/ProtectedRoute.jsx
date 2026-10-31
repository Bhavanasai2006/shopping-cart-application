import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute Guard
 * Note: Frontend route protection is solely for user experience and navigation flow.
 * Backend authorization remains strictly authoritative.
 */
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="sole-page-container">
        <div className="sole-loading-state" role="status" aria-live="polite">
          <div className="sole-spinner" aria-hidden="true"></div>
          <p>Verifying your session...</p>
        </div>
      </div>
    );
  }

  // 401 Unauthorized handling: preserve attempted location and redirect to appropriate login
  if (!isAuthenticated) {
    return <Navigate to={adminOnly ? "/admin/login" : "/login"} state={{ from: location }} replace />;
  }

  // 403 Forbidden handling: explicitly inform user that administrative privileges are required
  if (adminOnly && user?.role !== "admin") {
    return (
      <div className="sole-page-container">
        <div className="cart-empty-view" role="alert" aria-live="assertive">
          <div className="cart-empty-icon" aria-hidden="true">
            🚫
          </div>
          <h2>403 — Access Forbidden</h2>
          <p>
            Administrative privileges are required to access this dashboard.
            Frontend route guards are advisory; backend API authorization remains authoritative.
          </p>
          <Link to="/products">
            <button className="sole-primary-btn">Return to Skincare Collection</button>
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
