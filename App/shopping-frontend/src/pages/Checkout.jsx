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
  const { user, authFetch, fetchSavedAddresses, addSavedAddress, updateUserAddresses } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Stable idempotency key per logical checkout session
  const idempotencyKeyRef = useRef(generateClientUuid());

  // Saved Addresses state - starts empty until customer saves an address
  const initialSaved = Array.isArray(user?.savedAddresses) && user.savedAddresses.length > 0
    ? user.savedAddresses
    : [];
  const initialDefault = initialSaved.find((a) => a.isDefault) || initialSaved[0];

  const [savedAddresses, setSavedAddresses] = useState(initialSaved);
  const [selectedAddressId, setSelectedAddressId] = useState(
    initialDefault ? String(initialDefault._id) : "new"
  );
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(!initialDefault);
  const [saveAddressToAccount, setSaveAddressToAccount] = useState(true);
  const [savingAddressNow, setSavingAddressNow] = useState(false);

  // Shipping Address state (empty by default; populated once user saves or selects an address)
  const [shippingAddress, setShippingAddress] = useState({
    fullName: initialDefault?.fullName || user?.username || "",
    phone: initialDefault?.phone || "",
    addressLine1: initialDefault?.addressLine1 || "",
    addressLine2: initialDefault?.addressLine2 || "",
    city: initialDefault?.city || "",
    state: initialDefault?.state || "",
    postalCode: initialDefault?.postalCode || "",
    country: initialDefault?.country || ""
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

  const userId = user?.userId || user?._id || null;

  // Load and synchronize saved addresses whenever user signs in or checkout mounts
  useEffect(() => {
    let isMounted = true;

    async function loadUserAddresses() {
      if (!userId) return;

      // 1. First check if user already has saved addresses in auth state
      if (Array.isArray(user?.savedAddresses) && user.savedAddresses.length > 0) {
        if (!isMounted) return;
        const currentList = user.savedAddresses;
        setSavedAddresses(currentList);
        setSelectedAddressId((prevId) => {
          if (prevId && prevId !== "new" && currentList.some((a) => String(a._id) === String(prevId))) {
            return prevId;
          }
          const defaultAddr = currentList.find((a) => a.isDefault) || currentList[0];
          if (defaultAddr) {
            setShippingAddress({
              fullName: defaultAddr.fullName || user?.username || "",
              phone: defaultAddr.phone || "",
              addressLine1: defaultAddr.addressLine1 || "",
              addressLine2: defaultAddr.addressLine2 || "",
              city: defaultAddr.city || "",
              state: defaultAddr.state || "",
              postalCode: defaultAddr.postalCode || "",
              country: defaultAddr.country || ""
            });
            setIsAddingNewAddress(false);
            return String(defaultAddr._id);
          }
          return "new";
        });
      }

      // 2. Fetch fresh saved addresses from backend API
      if (fetchSavedAddresses) {
        try {
          const addrs = await fetchSavedAddresses();
          if (!isMounted) return;
          if (Array.isArray(addrs) && addrs.length > 0) {
            setSavedAddresses(addrs);
            setSelectedAddressId((prevId) => {
              if (prevId && prevId !== "new" && addrs.some((a) => String(a._id) === String(prevId))) {
                return prevId;
              }
              const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
              if (defaultAddr) {
                setShippingAddress({
                  fullName: defaultAddr.fullName || user?.username || "",
                  phone: defaultAddr.phone || "",
                  addressLine1: defaultAddr.addressLine1 || "",
                  addressLine2: defaultAddr.addressLine2 || "",
                  city: defaultAddr.city || "",
                  state: defaultAddr.state || "",
                  postalCode: defaultAddr.postalCode || "",
                  country: defaultAddr.country || ""
                });
                setIsAddingNewAddress(false);
                return String(defaultAddr._id);
              }
              return "new";
            });
          } else {
            setSavedAddresses([]);
            setSelectedAddressId("new");
            setIsAddingNewAddress(true);
          }
        } catch {
          // Keep current addresses
        }
      }
    }

    loadUserAddresses();

    return () => {
      isMounted = false;
    };
  }, [userId, fetchSavedAddresses]);

  // If user cart is empty, redirect back to cart
  useEffect(() => {
    if (cart.length === 0 && !loading) {
      navigate("/cart", { replace: true });
    }
  }, [cart, loading, navigate]);

  function handleSelectSavedAddress(addr) {
    const idStr = String(addr._id);
    setSelectedAddressId(idStr);
    setIsAddingNewAddress(false);
    setShippingAddress({
      fullName: addr.fullName || "",
      phone: addr.phone || "",
      addressLine1: addr.addressLine1 || "",
      addressLine2: addr.addressLine2 || "",
      city: addr.city || "",
      state: addr.state || "",
      postalCode: addr.postalCode || "",
      country: addr.country || ""
    });
    setFieldErrors({});
  }

  function handleSwitchToNewAddress() {
    setSelectedAddressId("new");
    setIsAddingNewAddress(true);
    setShippingAddress({
      fullName: user?.username ? (user.username.charAt(0).toUpperCase() + user.username.slice(1)) : "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: ""
    });
    setFieldErrors({});
  }

  async function handleSaveAddressNow() {
    if (!validateAddress()) {
      showToast({ type: "error", message: "Please fill in all required address fields before saving." });
      return;
    }

    setSavingAddressNow(true);
    try {
      if (addSavedAddress) {
        const payload = {
          fullName: shippingAddress.fullName.trim(),
          phone: shippingAddress.phone.trim(),
          addressLine1: shippingAddress.addressLine1.trim(),
          addressLine2: shippingAddress.addressLine2.trim(),
          city: shippingAddress.city.trim(),
          state: shippingAddress.state.trim(),
          postalCode: shippingAddress.postalCode.trim(),
          country: shippingAddress.country.trim(),
          isDefault: savedAddresses.length === 0
        };

        const result = await addSavedAddress(payload);
        const updatedList = result.addresses || [...savedAddresses, result.address];
        setSavedAddresses(updatedList);
        const newAddrId = result.address?._id || (updatedList.length > 0 ? updatedList[updatedList.length - 1]._id : null);
        if (newAddrId) {
          setSelectedAddressId(String(newAddrId));
        }
        setIsAddingNewAddress(false);
        showToast({
          type: "success",
          message: savedAddresses.length === 0
            ? "Address saved as your default shipping address!"
            : "Address saved to your profile!"
        });
      }
    } catch (err) {
      const localNewAddr = {
        _id: `addr_local_${Date.now()}`,
        ...shippingAddress,
        isDefault: savedAddresses.length === 0
      };
      setSavedAddresses((prev) => [...prev, localNewAddr]);
      setSelectedAddressId(localNewAddr._id);
      setIsAddingNewAddress(false);
      showToast({
        type: "success",
        message: savedAddresses.length === 0
          ? "Address saved as your default shipping address!"
          : "Address added for checkout!"
      });
    } finally {
      setSavingAddressNow(false);
    }
  }

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
      message: "Ready to retry checkout. Selected outcome set to Authorize."
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
            country: shippingAddress.country.trim()
          },
          idempotencyKey: activeKey,
          paymentMethod,
          simulateFailure: simulateOutcome === "failure",
          demoAccount: demoAccountString,
          saveAddress: (isAddingNewAddress || savedAddresses.length === 0) && saveAddressToAccount
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 402) {
          // Explicit simulated failure: cart preserved, safe retry enabled
          throw new Error(data.message || "Payment simulation declined. Please retry to authorize.");
        }
        if (res.status === 401) {
          throw new Error("Session expired. Please sign in again to complete your order.");
        }
        if (res.status === 409) {
          throw new Error(data.message || "Stock changed or duplicate checkout detected. Please review your order.");
        }
        throw new Error(data.message || "Failed to process order");
      }

      // Order successfully confirmed on the backend
      if (data.savedAddresses && typeof updateUserAddresses === "function") {
        updateUserAddresses(data.savedAddresses);
      } else if (fetchSavedAddresses) {
        try {
          await fetchSavedAddresses();
        } catch {
          // non-fatal
        }
      }

      await clearCart();
      showToast({
        type: "success",
        message: `Order #${String(data.orderId || data.order?._id || "").slice(-6).toUpperCase()} placed successfully!`
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
      let safeErr = sanitizeErrorMessage(err, "Unable to complete payment. Your cart has been preserved.");
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

      {errorMessage && (
        <div className="demo-error-banner" role="alert">
          <div className="demo-error-content">
            <span className="demo-error-icon" aria-hidden="true">!</span>
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
            ↻ Retry Payment
          </button>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} noValidate className="checkout-form-layout">
        <div className="checkout-main-grid">
          {/* Left Column: Shipping Address & Demo Payment */}
          <div className="checkout-left-column">
            {/* Step 1: Shipping Address Selection / Creation */}
            <div className="checkout-section-card">
              <div className="checkout-section-header">
                <span className="checkout-section-num" aria-hidden="true">1</span>
                <div>
                  <h2 className="checkout-section-title">Shipping & Delivery Details</h2>
                  <p className="checkout-section-desc">
                    {savedAddresses.length > 0
                      ? "Choose from your saved addresses or enter a new destination."
                      : "Provide your delivery address. Saving it will set it as your default shipping address."}
                  </p>
                </div>
              </div>

              {/* Saved Addresses Options List - rendered only after the customer has saved an address */}
              {savedAddresses.length > 0 && (
                <div className="saved-addresses-options-list" role="radiogroup" aria-label="Saved Delivery Addresses">
                  {savedAddresses.map((addr) => {
                    const isSelected = String(selectedAddressId) === String(addr._id) && !isAddingNewAddress;
                    return (
                      <div
                        key={String(addr._id)}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => handleSelectSavedAddress(addr)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            handleSelectSavedAddress(addr);
                          }
                        }}
                        className={`saved-address-card-option ${isSelected ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="deliveryAddressSelection"
                          value={String(addr._id)}
                          checked={isSelected}
                          onChange={() => handleSelectSavedAddress(addr)}
                          className="address-radio-input"
                        />
                        <div className="saved-address-content">
                          <div className="saved-address-header">
                            <strong className="saved-address-name">{addr.fullName}</strong>
                            <span className="saved-address-phone">{addr.phone}</span>
                            {addr.isDefault && (
                              <span className="address-default-badge">Default</span>
                            )}
                          </div>
                          <p className="saved-address-text">
                            {addr.addressLine1}
                            {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                            <br />
                            {addr.city}, {addr.state} {addr.postalCode}{addr.country ? ` • ${addr.country}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add New Address Radio Option */}
                  <div
                    role="radio"
                    aria-checked={isAddingNewAddress}
                    tabIndex={0}
                    onClick={handleSwitchToNewAddress}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        handleSwitchToNewAddress();
                      }
                    }}
                    className={`saved-address-card-option new-address-toggle-card ${isAddingNewAddress ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="deliveryAddressSelection"
                      value="new"
                      checked={isAddingNewAddress}
                      onChange={handleSwitchToNewAddress}
                      className="address-radio-input"
                    />
                    <div className="saved-address-content">
                      <div className="saved-address-header">
                        <span className="new-address-icon" aria-hidden="true">＋</span>
                        <strong className="saved-address-name">Deliver to a new address</strong>
                      </div>
                      <p className="saved-address-text">
                        Enter a different shipping destination and optionally save it to your profile.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected destination confirmation pill - only when a saved address is active */}
              {savedAddresses.length > 0 && !isAddingNewAddress && (
                <div className="selected-address-summary-pill">
                  
                  <div className="summary-pill-text">
                    <strong>Delivering to:</strong> {shippingAddress.fullName} • {shippingAddress.addressLine1}, {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                  </div>
                  <button
                    type="button"
                    className="summary-pill-change-btn"
                    onClick={handleSwitchToNewAddress}
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Address Input Form (renders if adding new address OR if user has no saved addresses yet) */}
              {(isAddingNewAddress || savedAddresses.length === 0) && (
                <div className="new-address-form-wrapper">
                  {savedAddresses.length > 0 && (
                    <div className="new-address-form-divider">
                      <span>Enter New Shipping Information</span>
                    </div>
                  )}

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
                        placeholder="e.g. United States, India, Canada, etc."
                        className="sole-input-pill"
                        autoComplete="country-name"
                      />
                    </div>
                  </div>

                  {/* Save to Profile Checkbox & Actions */}
                  <div className="new-address-actions-row">
                    <label className="save-address-checkbox-label">
                      <input
                        type="checkbox"
                        checked={saveAddressToAccount}
                        onChange={(e) => setSaveAddressToAccount(e.target.checked)}
                        className="save-address-checkbox"
                      />
                      <span>
                        {savedAddresses.length === 0
                          ? "Save this address as my default delivery address"
                          : "Save this address to my profile for future orders"}
                      </span>
                    </label>

                    <div className="new-address-btn-group">
                      <button
                        type="button"
                        onClick={handleSaveAddressNow}
                        disabled={savingAddressNow}
                        className="sole-secondary-btn save-now-btn"
                      >
                        {savingAddressNow ? "Saving..." : "Save to My Addresses"}
                      </button>
                      {savedAddresses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
                            if (defaultAddr) handleSelectSavedAddress(defaultAddr);
                          }}
                          className="profile-cancel-btn"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Payment Selection & Simulation Controls */}
            <div className="checkout-section-card demo-payment-card" style={{ marginTop: "24px" }}>
              <div className="checkout-section-header">
                <span className="checkout-section-num" aria-hidden="true">2</span>
                <div>
                  <h2 className="checkout-section-title">Payment Method</h2>
                  <p className="checkout-section-desc">
                    Select a simulated payment method. Testing mode enabled.
                  </p>
                </div>
              </div>

              {/* Payment Rail Options */}
              <div className="demo-payment-options-list" role="radiogroup" aria-label="Simulated Payment Methods">
                {/* 1. Simulated Card */}
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
                      
                      <strong className="demo-method-name">Credit / Debit Card</strong>
                      <span className="demo-pill-badge">Simulated Card</span>
                    </div>
                    <p className="demo-method-sub">
                      Simulate payment authorization with test card details. No CVV or PIN required.
                    </p>

                    {paymentMethod === "DEMO_SIMULATION" && (
                      <div className="demo-instant-box">
                        <span className="demo-security-guarantee">
                          Pure sandbox simulation. Directly tests end-to-end checkout, authoritative pricing, and stock confirmation without prompting for card credentials.
                        </span>
                      </div>
                    )}
                  </div>
                </label>

                {/* 2. Simulated UPI */}
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
                      
                      <strong className="demo-method-name">UPI / QR Payment</strong>
                      <span className="demo-pill-badge">Simulated UPI</span>
                    </div>
                    <p className="demo-method-sub">
                      Simulate mobile UPI intent or QR verification with a test VPA handle.
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
                          placeholder="username@bank"
                          className="sole-input-pill"
                        />
                        <div className="demo-qr-mock">
                          
                          <span>Simulated QR Code: Scan & Pay with UPI</span>
                        </div>
                        <span className="demo-security-guarantee">
                          Simulated UPI gateway. No UPI PIN, mobile banking password, or OTP required.
                        </span>
                      </div>
                    )}
                  </div>
                </label>

                {/* 3. Cash on Delivery */}
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
                      
                      <strong className="demo-method-name">Cash on Delivery</strong>
                      <span className="demo-pill-badge">Pay on Delivery</span>
                    </div>
                    <p className="demo-method-sub">
                      Order will be placed in pending status to simulate pay-on-arrival.
                    </p>
                  </div>
                </label>
              </div>

              {/* Simulation Outcome Controller: Success vs. Failure (Testing & Safe Retry) */}
              <div className="demo-simulation-controls">
                <span className="simulation-controls-label">
                  Payment Simulation Mode:
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
                    <span>Authorize (Simulate Success)</span>
                  </label>

                  <label className={`simulation-pill-btn ${simulateOutcome === "failure" ? "active-failure" : ""}`}>
                    <input
                      type="radio"
                      name="simulateOutcome"
                      value="failure"
                      checked={simulateOutcome === "failure"}
                      onChange={() => setSimulateOutcome("failure")}
                    />
                    <span>Decline (Simulate Failure)</span>
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
                  <strong>Payment Simulation:</strong> Safe sandbox environment. Authoritative prices and stock verified directly on the backend.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || cart.length === 0}
                className="sole-primary-btn checkout-submit-btn"
                aria-label={`Confirm order for ${formatINR(totals.grandTotal)}`}
              >
                {loading ? (
                  <span className="btn-spinner-wrap">
                    <span className="btn-spinner" aria-hidden="true" />
                    Processing Payment...
                  </span>
                ) : simulateOutcome === "failure" ? (
                  `Test Decline • ${formatINR(totals.grandTotal)}`
                ) : (
                  paymentMethod === "DEMO_UPI"
                    ? `Pay with UPI • ${formatINR(totals.grandTotal)}`
                    : paymentMethod === "DEMO_COD"
                    ? `Place Order (COD) • ${formatINR(totals.grandTotal)}`
                    : `Pay with Card • ${formatINR(totals.grandTotal)}`
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
