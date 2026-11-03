import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_URL from "../api";
import { sanitizeErrorMessage } from "../utils/security";
import SkincareImage from "../components/SkincareImage";
import { formatINR } from "../utils/formatCurrency";

function generateClientUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sole_order_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function Checkout() {
  const navigate = useNavigate();
  const { cart, totals, clearCart, verifyAuthoritativeData } = useCart();
  const { user, authFetch } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Stable idempotency key per logical checkout session
  const idempotencyKeyRef = useRef(generateClientUuid());

  // Shipping Address state
  const [shippingAddress, setShippingAddress] = useState({
    fullName: user?.username || "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States"
  });

  // DEMO PAYMENT SYSTEM STATE
  const [paymentMethod, setPaymentMethod] = useState("DEMO_SIMULATION"); // DEMO_SIMULATION | DEMO_UPI | DEMO_COD
  const [demoUpiId, setDemoUpiId] = useState(
    user?.username ? `${user.username.toLowerCase()}@demoupi` : "customer@demoupi"
  );
  const [simulateOutcome, setSimulateOutcome] = useState("success"); // "success" | "failure"

  // Re-verify authoritative prices & live stock when entering Checkout page
  useEffect(() => {
    verifyAuthoritativeData();
  }, [verifyAuthoritativeData]);

  // If user cart is empty, redirect back to cart
  useEffect(() => {
    if (cart.length === 0 && !loading) {
      navigate("/cart", { replace: true });
    }
  }, [cart, loading, navigate]);

  function handleInputChange(e) {
    const { name, value } = e.target;
    setShippingAddress((prev) => ({
      ...prev,
      [name]: value
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: ""
      }));
    }
  }

  function validateAddress() {
    const errors = {};

    if (!shippingAddress.fullName.trim() || shippingAddress.fullName.trim().length < 2) {
      errors.fullName = "Recipient name must be at least 2 characters";
    }

    if (!shippingAddress.phone.trim() || shippingAddress.phone.trim().length < 7) {
      errors.phone = "Valid contact phone number is required";
    }

    if (!shippingAddress.addressLine1.trim() || shippingAddress.addressLine1.trim().length < 3) {
      errors.addressLine1 = "Delivery street address is required";
    }

    if (!shippingAddress.city.trim() || shippingAddress.city.trim().length < 2) {
      errors.city = "City name is required";
    }

    if (!shippingAddress.state.trim() || shippingAddress.state.trim().length < 2) {
      errors.state = "State or Province is required";
    }

    if (!shippingAddress.postalCode.trim() || shippingAddress.postalCode.trim().length < 3) {
      errors.postalCode = "Valid postal/ZIP code is required";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleRetryDemoPayment() {
    setErrorMessage("");
    setSimulateOutcome("success");
    idempotencyKeyRef.current = generateClientUuid();
    showToast({
      type: "info",
      message: "Ready to retry demo checkout. Selected outcome set to Authorize."
    });
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();

    if (!user) {
      navigate("/login", { state: { from: { pathname: "/checkout" } } });
      return;
    }

    if (cart.length === 0) {
      showToast({ type: "error", message: "Your shopping cart is empty." });
      navigate("/cart");
      return;
    }

    if (!validateAddress()) {
      showToast({ type: "error", message: "Please fill in all required shipping address fields." });
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const isObjectId = (val) => /^[0-9a-fA-F]{24}$/.test(val);
      const itemsPayload = cart
        .filter((item) => isObjectId(item._id || item.productId))
        .map((item) => ({
          productId: item._id || item.productId,
          quantity: item.cartQty
        }));

      const hasUnavailable = cart.some(
        (item) => item.isActive === false || (item.quantity != null && item.quantity <= 0)
      );
      if (hasUnavailable) {
        throw new Error("One or more items in your cart are currently unavailable. Please return to your cart and remove them.");
      }

      if (itemsPayload.length === 0) {
        throw new Error("No valid products found in shopping cart.");
      }

      const activeKey = idempotencyKeyRef.current;
      const demoAccountString =
        paymentMethod === "DEMO_UPI"
          ? demoUpiId.trim() || "customer@demoupi"
          : paymentMethod === "DEMO_COD"
          ? "Cash on Delivery (Simulated)"
          : "Instant Sandbox Simulation";

      const res = await authFetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": activeKey
        },
        body: JSON.stringify({
          userId: user.userId || user._id,
          items: itemsPayload,
          shippingAddress: {
            fullName: shippingAddress.fullName.trim(),
            phone: shippingAddress.phone.trim(),
            addressLine1: shippingAddress.addressLine1.trim(),
            addressLine2: shippingAddress.addressLine2.trim(),
            city: shippingAddress.city.trim(),
            state: shippingAddress.state.trim(),
            postalCode: shippingAddress.postalCode.trim(),
            country: shippingAddress.country.trim() || "United States"
          },
          idempotencyKey: activeKey,
          paymentMethod,
          simulateFailure: simulateOutcome === "failure",
          demoAccount: demoAccountString
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 402) {
          // Explicit simulated failure: cart preserved, safe retry enabled
          throw new Error(data.message || "Simulated Demo Payment Failed. Please retry with valid demo authorization.");
        }
        if (res.status === 401) {
          throw new Error("Session expired. Please sign in again to complete your order.");
        }
        if (res.status === 409) {
          throw new Error(data.message || "Stock changed or duplicate checkout detected. Please review your order.");
        }
        throw new Error(data.message || "Failed to process demo order");
      }

      // Order successfully confirmed on the backend
      await clearCart();
      showToast({
        type: "success",
        message: `Demo Order #${String(data.orderId || data.order?._id || "").slice(-6).toUpperCase()} placed successfully!`
      });

      // Navigate to order confirmation receipt
      navigate("/order-success", {
        replace: true,
        state: {
          order: data.order,
          orderId: data.orderId || data.order?._id
        }
      });
    } catch (err) {
      let safeErr = sanitizeErrorMessage(err, "Unable to complete demo payment. Your cart has been preserved.");
      if (err.message === "Failed to fetch" || (err.name === "TypeError" && String(err.message).toLowerCase().includes("fetch"))) {
        safeErr = "Backend server is unreachable. Please ensure the backend is running on http://localhost:5000.";
      }
      setErrorMessage(safeErr);
      showToast({
        type: "error",
        message: safeErr
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sole-page-container">
      {/* Header Navigation */}
      <div className="cart-header-row">
        <Link
          to="/cart"
          className="icon-circle-btn"
          title="Back to cart"
          aria-label="Back to cart"
        >
          ‹
        </Link>
        <h1 className="cart-header-title">Checkout</h1>
        <div style={{ width: "36px" }} />
      </div>

      {/* MANDATORY PROMINENT DEMO PAYMENT DISCLAIMER BANNER */}
      <div className="demo-payment-alert-box" role="alert" aria-label="Demo Payment Notice">
        <div className="demo-alert-header">
          <span className="demo-alert-shield" aria-hidden="true">🛡️</span>
          <span className="demo-alert-title">DEMO PAYMENT — No real money is transferred.</span>
        </div>
        <p className="demo-alert-desc">
          This checkout utilizes a simulated payment gateway for demonstration and testing purposes.
          Real credit card details, CVV, UPI PIN, OTP or banking credentials are <strong>never collected or required</strong>.
        </p>
      </div>

      {errorMessage && (
        <div className="demo-error-banner" role="alert">
          <div className="demo-error-content">
            <span className="demo-error-icon" aria-hidden="true">⚠</span>
            <div>
              <strong className="demo-error-title">Simulated Payment Notice</strong>
              <p className="demo-error-message">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetryDemoPayment}
            className="demo-retry-action-btn"
          >
            ↻ Retry Demo Payment
          </button>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} noValidate className="checkout-form-layout">
        <div className="checkout-main-grid">
          {/* Left Column: Shipping Address & Demo Payment */}
          <div className="checkout-left-column">
            {/* Step 1: Shipping Address */}
            <div className="checkout-section-card">
              <div className="checkout-section-header">
                <span className="checkout-section-num" aria-hidden="true">1</span>
                <div>
                  <h2 className="checkout-section-title">Shipping & Delivery Details</h2>
                  <p className="checkout-section-desc">
                    Provide the destination address for simulated fulfillment.
                  </p>
                </div>
              </div>

              <div className="checkout-fields-grid">
                <div className="form-field-group">
                  <label htmlFor="fullName" className="sole-form-label">
                    Recipient Full Name <span className="field-required">*</span>
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={shippingAddress.fullName}
                    onChange={handleInputChange}
                    placeholder="e.g. Eleanor Vance"
                    className={`sole-input-pill ${fieldErrors.fullName ? "input-error" : ""}`}
                    autoComplete="name"
                    required
                  />
                  {fieldErrors.fullName && (
                    <span className="field-error-text" role="alert">{fieldErrors.fullName}</span>
                  )}
                </div>

                <div className="form-field-group">
                  <label htmlFor="phone" className="sole-form-label">
                    Phone Number <span className="field-required">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={shippingAddress.phone}
                    onChange={handleInputChange}
                    placeholder="e.g. +1 (555) 019-2834"
                    className={`sole-input-pill ${fieldErrors.phone ? "input-error" : ""}`}
                    autoComplete="tel"
                    required
                  />
                  {fieldErrors.phone && (
                    <span className="field-error-text" role="alert">{fieldErrors.phone}</span>
                  )}
                </div>

                <div className="form-field-group full-width">
                  <label htmlFor="addressLine1" className="sole-form-label">
                    Street Address <span className="field-required">*</span>
                  </label>
                  <input
                    type="text"
                    id="addressLine1"
                    name="addressLine1"
                    value={shippingAddress.addressLine1}
                    onChange={handleInputChange}
                    placeholder="Street name and number"
                    className={`sole-input-pill ${fieldErrors.addressLine1 ? "input-error" : ""}`}
                    autoComplete="address-line1"
                    required
                  />
                  {fieldErrors.addressLine1 && (
                    <span className="field-error-text" role="alert">{fieldErrors.addressLine1}</span>
                  )}
                </div>

                <div className="form-field-group full-width">
                  <label htmlFor="addressLine2" className="sole-form-label">
                    Apt, Suite, Building <small className="label-optional">(Optional)</small>
                  </label>
                  <input
                    type="text"
                    id="addressLine2"
                    name="addressLine2"
                    value={shippingAddress.addressLine2}
                    onChange={handleInputChange}
                    placeholder="Apt, Suite, Unit, etc."
                    className="sole-input-pill"
                    autoComplete="address-line2"
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="city" className="sole-form-label">
                    City <span className="field-required">*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={shippingAddress.city}
                    onChange={handleInputChange}
                    placeholder="City"
                    className={`sole-input-pill ${fieldErrors.city ? "input-error" : ""}`}
                    autoComplete="address-level2"
                    required
                  />
                  {fieldErrors.city && (
                    <span className="field-error-text" role="alert">{fieldErrors.city}</span>
                  )}
                </div>

                <div className="form-row-halves">
                  <div className="form-field-group">
                    <label htmlFor="state" className="sole-form-label">
                      State <span className="field-required">*</span>
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={shippingAddress.state}
                      onChange={handleInputChange}
                      placeholder="State"
                      className={`sole-input-pill ${fieldErrors.state ? "input-error" : ""}`}
                      autoComplete="address-level1"
                      required
                    />
                    {fieldErrors.state && (
                      <span className="field-error-text" role="alert">{fieldErrors.state}</span>
                    )}
                  </div>

                  <div className="form-field-group">
                    <label htmlFor="postalCode" className="sole-form-label">
                      ZIP Code <span className="field-required">*</span>
                    </label>
                    <input
                      type="text"
                      id="postalCode"
                      name="postalCode"
                      value={shippingAddress.postalCode}
                      onChange={handleInputChange}
                      placeholder="Postal Code"
                      className={`sole-input-pill ${fieldErrors.postalCode ? "input-error" : ""}`}
                      autoComplete="postal-code"
                      required
                    />
                    {fieldErrors.postalCode && (
                      <span className="field-error-text" role="alert">{fieldErrors.postalCode}</span>
                    )}
                  </div>
                </div>

                <div className="form-field-group full-width">
                  <label htmlFor="country" className="sole-form-label">
                    Country
                  </label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    value={shippingAddress.country}
                    onChange={handleInputChange}
                    className="sole-input-pill"
                    autoComplete="country-name"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: DEMO Payment Selection & Simulation Controls */}
            <div className="checkout-section-card demo-payment-card" style={{ marginTop: "24px" }}>
              <div className="checkout-section-header">
                <span className="checkout-section-num" aria-hidden="true">2</span>
                <div>
                  <h2 className="checkout-section-title">Demo Payment Method</h2>
                  <p className="checkout-section-desc">
                    Select a simulated demo payment rail. No real money or bank accounts are accessed.
                  </p>
                </div>
              </div>

              {/* Payment Rail Options */}
              <div className="demo-payment-options-list" role="radiogroup" aria-label="Simulated Payment Methods">
                {/* 1. Instant Demo Simulation */}
                <label className={`demo-method-option ${paymentMethod === "DEMO_SIMULATION" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="DEMO_SIMULATION"
                    checked={paymentMethod === "DEMO_SIMULATION"}
                    onChange={() => setPaymentMethod("DEMO_SIMULATION")}
                    className="demo-radio-input"
                  />
                  <div className="demo-method-content">
                    <div className="demo-method-header-row">
                      <span className="demo-method-icon" aria-hidden="true">⚡</span>
                      <strong className="demo-method-name">Instant Demo Simulation</strong>
                      <span className="demo-pill-badge">Safe Sandbox</span>
                    </div>
                    <p className="demo-method-sub">
                      Simulate a direct sandbox payment authorization. No card numbers, bank details, or sensitive credentials required.
                    </p>

                    {paymentMethod === "DEMO_SIMULATION" && (
                      <div className="demo-instant-box">
                        <span className="demo-security-guarantee">
                          🔒 Pure sandbox simulation. Directly tests end-to-end checkout, authoritative pricing, and stock confirmation without prompting for any card credentials.
                        </span>
                      </div>
                    )}
                  </div>
                </label>

                {/* 2. UPI Demo */}
                <label className={`demo-method-option ${paymentMethod === "DEMO_UPI" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="DEMO_UPI"
                    checked={paymentMethod === "DEMO_UPI"}
                    onChange={() => setPaymentMethod("DEMO_UPI")}
                    className="demo-radio-input"
                  />
                  <div className="demo-method-content">
                    <div className="demo-method-header-row">
                      <span className="demo-method-icon" aria-hidden="true">📱</span>
                      <strong className="demo-method-name">UPI Demo (Simulated)</strong>
                      <span className="demo-pill-badge">Instant Intent</span>
                    </div>
                    <p className="demo-method-sub">
                      Simulate mobile UPI intent or QR verification with a demo VPA handle.
                    </p>

                    {paymentMethod === "DEMO_UPI" && (
                      <div className="demo-upi-box">
                        <label htmlFor="demoUpiInput" className="demo-sub-label">
                          Simulated UPI VPA Handle:
                        </label>
                        <input
                          type="text"
                          id="demoUpiInput"
                          value={demoUpiId}
                          onChange={(e) => setDemoUpiId(e.target.value)}
                          placeholder="username@demoupi"
                          className="sole-input-pill"
                        />
                        <div className="demo-qr-mock">
                          <span className="demo-qr-icon" aria-hidden="true">⛶</span>
                          <span>Simulated QR Code: Scan & Pay with Demo UPI</span>
                        </div>
                        <span className="demo-security-guarantee">
                          🔒 Simulated UPI gateway. No UPI PIN, mobile banking password, or OTP required.
                        </span>
                      </div>
                    )}
                  </div>
                </label>

                {/* 3. Cash on Delivery Demo */}
                <label className={`demo-method-option ${paymentMethod === "DEMO_COD" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="DEMO_COD"
                    checked={paymentMethod === "DEMO_COD"}
                    onChange={() => setPaymentMethod("DEMO_COD")}
                    className="demo-radio-input"
                  />
                  <div className="demo-method-content">
                    <div className="demo-method-header-row">
                      <span className="demo-method-icon" aria-hidden="true">📦</span>
                      <strong className="demo-method-name">Cash on Delivery (Demo COD)</strong>
                      <span className="demo-pill-badge">Pay on Delivery</span>
                    </div>
                    <p className="demo-method-sub">
                      Order will be placed in pending demo payment status to simulate pay-on-arrival.
                    </p>
                  </div>
                </label>
              </div>

              {/* Simulation Outcome Controller: Success vs. Failure (Testing & Safe Retry) */}
              <div className="demo-simulation-controls">
                <span className="simulation-controls-label">
                  🧪 Test Scenario Simulation Control:
                </span>
                <div className="simulation-radio-row">
                  <label className={`simulation-pill-btn ${simulateOutcome === "success" ? "active-success" : ""}`}>
                    <input
                      type="radio"
                      name="simulateOutcome"
                      value="success"
                      checked={simulateOutcome === "success"}
                      onChange={() => setSimulateOutcome("success")}
                    />
                    <span>🟢 Simulate Success (Authorize Order)</span>
                  </label>

                  <label className={`simulation-pill-btn ${simulateOutcome === "failure" ? "active-failure" : ""}`}>
                    <input
                      type="radio"
                      name="simulateOutcome"
                      value="failure"
                      checked={simulateOutcome === "failure"}
                      onChange={() => setSimulateOutcome("failure")}
                    />
                    <span>🔴 Simulate Failure (Test Decline & Retry)</span>
                  </label>
                </div>
                <small className="simulation-hint">
                  Simulating a decline returns an authorization error, leaves your cart untouched, avoids inventory deduction, and allows you to test immediate retry.
                </small>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="checkout-summary-column">
            <div className="checkout-section-card">
              <div className="checkout-section-header">
                <span className="checkout-section-num" aria-hidden="true">3</span>
                <div>
                  <h2 className="checkout-section-title">Order Summary</h2>
                  <p className="checkout-section-desc">
                    {cart.reduce((sum, item) => sum + (item.cartQty || 1), 0)} items in your cart
                  </p>
                </div>
              </div>

              {/* Itemized Snapshot Preview */}
              <div className="checkout-items-list" role="list" aria-label="Items in your order">
                {cart.map((item) => {
                  const pId = item._id || item.productId;
                  const itemPrice = Number(item.productPrice || 0);
                  const qty = Number(item.cartQty || 1);
                  const lineTotal = itemPrice * qty;

                  return (
                    <div key={pId} className="checkout-item-row" role="listitem">
                      <div className="checkout-item-thumb">
                        <SkincareImage
                          src={item.image}
                          alt={item.productName}
                          className="checkout-thumb-img"
                        />
                      </div>
                      <div className="checkout-item-details">
                        <span className="checkout-item-name">{item.productName}</span>
                        <span className="checkout-item-qty">
                          Qty: {qty} × {formatINR(itemPrice)}
                        </span>
                      </div>
                      <div className="checkout-item-total">
                        {formatINR(lineTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="checkout-totals-block">
                <div className="checkout-total-line">
                  <span>Items Subtotal</span>
                  <strong>{formatINR(totals.itemsSubtotal)}</strong>
                </div>

                <div className="checkout-total-line">
                  <span>Standard Skincare Delivery</span>
                  <span className="free-shipping-tag">Complimentary</span>
                </div>

                <div className="checkout-total-divider" />

                <div className="checkout-grand-total-line">
                  <span>Total Due</span>
                  <strong className="grand-total-amount">
                    {formatINR(totals.grandTotal)}
                  </strong>
                </div>
              </div>

              <div className="checkout-notice-box">
                <span className="checkout-notice-icon" aria-hidden="true">✓</span>
                <p>
                  <strong>DEMO PAYMENT:</strong> No real currency will be charged. Authoritative prices and stock verified directly on the backend.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || cart.length === 0}
                className="sole-primary-btn checkout-submit-btn"
                aria-label={`Confirm demo order for ${formatINR(totals.grandTotal)}`}
              >
                {loading ? (
                  <span className="btn-spinner-wrap">
                    <span className="btn-spinner" aria-hidden="true" />
                    Processing Demo Payment...
                  </span>
                ) : simulateOutcome === "failure" ? (
                  `Test Decline • ${formatINR(totals.grandTotal)}`
                ) : (
                  paymentMethod === "DEMO_UPI"
                    ? `Pay with Demo UPI • ${formatINR(totals.grandTotal)}`
                    : paymentMethod === "DEMO_COD"
                    ? `Confirm Demo COD • ${formatINR(totals.grandTotal)}`
                    : `Complete Demo Payment • ${formatINR(totals.grandTotal)}`
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default Checkout;
