import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { sanitizeErrorMessage } from "../utils/security";

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    username: "",
    emailId: "",
    age: "",
    password: "",
    confirmPassword: ""
  });

  const [touched, setTouched] = useState({
    username: false,
    emailId: false,
    age: false,
    password: false,
    confirmPassword: false
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Field Validations
  const isUsernameValid = form.username.trim().length >= 2 && form.username.trim().length <= 50;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailId.trim());
  const parsedAge = Number(form.age);
  const isAgeValid = !isNaN(parsedAge) && parsedAge >= 1 && parsedAge <= 120;
  const isPasswordValid = form.password.length >= 8;
  const isConfirmValid = form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  const isFormValid =
    isUsernameValid &&
    isEmailValid &&
    isAgeValid &&
    isPasswordValid &&
    isConfirmValid;

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  function handleBlur(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    if (!isUsernameValid) {
      setErrorMessage("Username must be between 2 and 50 characters.");
      return;
    }
    if (!isEmailValid) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!isAgeValid) {
      setErrorMessage("Age must be a valid number between 1 and 120.");
      return;
    }
    if (!isPasswordValid) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await register({
        username: form.username.trim(),
        emailId: form.emailId.trim().toLowerCase(),
        age: parsedAge,
        password: form.password
      });

      showToast({
        type: "success",
        message: "Registration successful! Please sign in to your new SOLE account."
      });
      navigate("/login");
    } catch (err) {
      setErrorMessage(sanitizeErrorMessage(err, "Registration failed"));
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
        aria-labelledby="register-heading"
      >
        <h2 id="register-heading">Create Account</h2>
        <p className="auth-subtitle">Join SOLE for natural skincare care</p>

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="form-field-group">
          <label htmlFor="reg-username">Full Name / Username</label>
          <input
            id="reg-username"
            name="username"
            placeholder="e.g. Elena Rostova"
            value={form.username}
            onChange={handleChange}
            onBlur={() => handleBlur("username")}
            required
            autoComplete="name"
            className={touched.username && !isUsernameValid ? "input-invalid" : ""}
            aria-invalid={touched.username && !isUsernameValid}
            aria-describedby={
              touched.username && !isUsernameValid ? "reg-user-err" : undefined
            }
          />
          {touched.username && !isUsernameValid && (
            <span id="reg-user-err" className="field-hint-error" role="alert">
              Username must be between 2 and 50 characters.
            </span>
          )}
        </div>

        <div className="form-field-group">
          <label htmlFor="reg-email">Email Address</label>
          <input
            id="reg-email"
            name="emailId"
            type="email"
            placeholder="you@example.com"
            value={form.emailId}
            onChange={handleChange}
            onBlur={() => handleBlur("emailId")}
            required
            autoComplete="email"
            className={touched.emailId && !isEmailValid ? "input-invalid" : ""}
            aria-invalid={touched.emailId && !isEmailValid}
            aria-describedby={
              touched.emailId && !isEmailValid ? "reg-email-err" : undefined
            }
          />
          {touched.emailId && !isEmailValid && (
            <span id="reg-email-err" className="field-hint-error" role="alert">
              Please enter a valid email address.
            </span>
          )}
        </div>

        <div className="form-field-group">
          <label htmlFor="reg-age">Age</label>
          <input
            id="reg-age"
            name="age"
            type="number"
            min="1"
            max="120"
            placeholder="e.g. 25"
            value={form.age}
            onChange={handleChange}
            onBlur={() => handleBlur("age")}
            required
            className={touched.age && !isAgeValid ? "input-invalid" : ""}
            aria-invalid={touched.age && !isAgeValid}
            aria-describedby={
              touched.age && !isAgeValid ? "reg-age-err" : undefined
            }
          />
          {touched.age && !isAgeValid && (
            <span id="reg-age-err" className="field-hint-error" role="alert">
              Age must be between 1 and 120.
            </span>
          )}
        </div>

        <div className="form-field-group">
          <label htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            name="password"
            type="password"
            placeholder="Min 8 characters"
            value={form.password}
            onChange={handleChange}
            onBlur={() => handleBlur("password")}
            required
            autoComplete="new-password"
            className={touched.password && !isPasswordValid ? "input-invalid" : ""}
            aria-invalid={touched.password && !isPasswordValid}
            aria-describedby="reg-pass-hint"
          />
          <span
            id="reg-pass-hint"
            className={`field-hint ${
              form.password.length > 0 && !isPasswordValid
                ? "hint-warning"
                : isPasswordValid
                ? "hint-valid"
                : ""
            }`}
          >
            {isPasswordValid
              ? "✓ Minimum 8 characters met"
              : "Password must be at least 8 characters"}
          </span>
        </div>

        <div className="form-field-group">
          <label htmlFor="reg-confirm-password">Confirm Password</label>
          <input
            id="reg-confirm-password"
            name="confirmPassword"
            type="password"
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={handleChange}
            onBlur={() => handleBlur("confirmPassword")}
            required
            autoComplete="new-password"
            className={
              touched.confirmPassword && !isConfirmValid ? "input-invalid" : ""
            }
            aria-invalid={touched.confirmPassword && !isConfirmValid}
            aria-describedby="reg-confirm-hint"
          />
          {form.confirmPassword.length > 0 && (
            <span
              id="reg-confirm-hint"
              className={`field-hint ${
                isConfirmValid ? "hint-valid" : "hint-warning"
              }`}
            >
              {isConfirmValid ? "✓ Passwords match" : "✕ Passwords do not match"}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || !isFormValid}
          className="sole-primary-btn auth-submit-btn"
          aria-label={submitting ? "Creating Account..." : "Create Account"}
        >
          {submitting ? (
            <span className="btn-spinner-wrap">
              <span className="btn-spinner" aria-hidden="true" />
              Creating Account...
            </span>
          ) : (
            "Create Account"
          )}
        </button>

        <p className="auth-switch-text">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
