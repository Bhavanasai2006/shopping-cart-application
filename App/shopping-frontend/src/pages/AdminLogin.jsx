import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { sanitizeErrorMessage } from "../utils/security";

function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, logout, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [emailId, setEmailId] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated as admin, redirect to admin dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    const trimmedEmail = emailId.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMessage("Admin email address is required.");
      return;
    }

    if (!password) {
      setErrorMessage("Admin password is required.");
      return;
    }

    setSubmitting(true);

    try {
      const loggedUser = await login(trimmedEmail, password);

      // Verify server-validated admin role
      if (loggedUser.role !== "admin") {
        // Discard session immediately to prevent privilege confusion
        await logout();
        setErrorMessage(
          "Access Denied: Your account does not possess administrative privileges. Please use an authorized administrator profile."
        );
        return;
      }

      showToast({
        type: "success",
        message: `Welcome to SOLE Portal, ${loggedUser.username}!`
      });

      const redirectPath = location.state?.from?.pathname || "/admin/dashboard";
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setErrorMessage(
        sanitizeErrorMessage(
          err,
          "Invalid administrator credentials or access restricted."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <Link to="/products" className="admin-login-brand">
            <img src="/sole-logo.png" alt="SOLE Logo" className="admin-login-icon" />
            <span>SOLE</span>
          </Link>
          <span className="admin-login-badge">ADMINISTRATIVE ACCESS</span>
          <p className="admin-login-subtitle">
            Secure catalog, inventory & order management portal
          </p>
        </div>

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form" noValidate>
          <div className="form-field-group">
            <label htmlFor="admin-email">Administrator Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              placeholder="admin@sole-skincare.com"
              value={emailId}
              onChange={(e) => setEmailId(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-field-group">
            <label htmlFor="admin-password">Administrator Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !emailId || !password}
            className="sole-primary-btn admin-submit-btn"
            aria-label={submitting ? "Verifying administrative credentials..." : "Authenticate as Admin"}
          >
            {submitting ? (
              <span className="btn-spinner-wrap">
                <span className="btn-spinner" aria-hidden="true" />
                Authenticating...
              </span>
            ) : (
              "Sign In to Admin Portal"
            )}
          </button>
        </form>

        <div className="admin-login-footer">
          <p>
            Customer shopping?{" "}
            <Link to="/login" className="admin-footer-link">
              Go to Customer Sign In
            </Link>{" "}
            or{" "}
            <Link to="/products" className="admin-footer-link">
              Browse Store
            </Link>
          </p>
          <small className="admin-security-notice">
            🔒 Protected administrative system. Unauthorized access attempts are monitored and logged.
          </small>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
