import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { sanitizeAppPath, sanitizeErrorMessage } from "../utils/security";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [emailId, setEmailId] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Email format validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailId.trim());
  const showEmailError = touched.email && emailId.trim().length > 0 && !isEmailValid;

  // Validate and sanitize user-controlled redirect path against open redirects
  const from = sanitizeAppPath(location.state?.from, "/products");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    if (!isEmailValid) {
      setErrorMessage("Please enter a valid email address");
      return;
    }

    if (!password) {
      setErrorMessage("Password is required");
      return;
    }

    setSubmitting(true);

    try {
      const loggedUser = await login(emailId.trim().toLowerCase(), password);
      showToast({
        type: "success",
        message: `Welcome back, ${loggedUser.username || "beauty enthusiast"}!`
      });
      if (loggedUser.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMessage(sanitizeErrorMessage(err, "Invalid email or password"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      <form
        className="auth-card"
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="login-heading"
      >
        <h2 id="login-heading">Welcome Back</h2>
        <p className="auth-subtitle">Sign in to your SOLE account</p>

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="form-field-group">
          <label htmlFor="login-email">Email Address</label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={emailId}
            onChange={(e) => setEmailId(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            required
            autoComplete="email"
            className={showEmailError ? "input-invalid" : ""}
            aria-invalid={showEmailError}
            aria-describedby={showEmailError ? "login-email-error" : undefined}
          />
          {showEmailError && (
            <span id="login-email-error" className="field-hint-error" role="alert">
              Please enter a valid email address (e.g., name@domain.com)
            </span>
          )}
        </div>

        <div className="form-field-group">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !emailId || !password}
          className="sole-primary-btn auth-submit-btn"
          aria-label={submitting ? "Signing In..." : "Sign In"}
        >
          {submitting ? (
            <span className="btn-spinner-wrap">
              <span className="btn-spinner" aria-hidden="true" />
              Signing In...
            </span>
          ) : (
            "Sign In"
          )}
        </button>

        <p className="auth-switch-text">
          New to SOLE? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
