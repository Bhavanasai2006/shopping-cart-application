import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import API_URL from "../api";
import SkincareImage from "../components/SkincareImage";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { sanitizeErrorMessage } from "../utils/security";
import { formatINR } from "../utils/formatCurrency";

function Cart() {
  const { user, authFetch } = useAuth();
  const {
    cart,
    updateQty,
    removeFromCart,
    clearCart,
    totals,
    authoritativeNotice,
    verifyAuthoritativeData
  } = useCart();
  const { showToast } = useToast();

  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);

  // Re-verify authoritative prices & stock when entering Cart page
  useEffect(() => {
    verifyAuthoritativeData();
  }, [verifyAuthoritativeData]);

  function handleProceedToCheckout() {
    if (!user) {
      navigate("/login", { state: { from: { pathname: "/checkout" } } });
      return;
    }

    if (cart.length === 0) return;

    const hasUnavailable = cart.some(
      (item) => item.isActive === false || (item.quantity != null && item.quantity <= 0)
    );
    if (hasUnavailable) {
      showToast({
        type: "error",
        message: "Please remove unavailable products from your cart before checkout."
      });
      return;
    }

    navigate("/checkout");
  }

  function handleConfirmClearCart() {
    setShowClearConfirm(false);
    clearCart();
    showToast({ type: "info", message: "Shopping cart emptied." });
  }

  function handleConfirmRemoveItem() {
    if (itemToRemove) {
      removeFromCart(itemToRemove._id || itemToRemove.productId);
      showToast({
        type: "info",
        message: `${itemToRemove.productName} removed from cart.`
      });
      setItemToRemove(null);
    }
  }

  return (
    <div className="sole-page-container cart-page-wrap">
      {/* Top Header */}
      <div className="cart-header-row">
        <Link
          to="/products"
          className="icon-circle-btn"
          title="Back to products"
          aria-label="Back to products"
        >
          ‹
        </Link>
        <h1 className="cart-header-title">
          My cart
        </h1>

        <div className="cart-header-right-actions">
          {cart.length > 0 && (
            <button
              className="cart-clear-all-btn"
              onClick={() => setShowClearConfirm(true)}
              title="Empty entire cart"
              aria-label="Empty entire cart"
            >
              Empty
            </button>
          )}
          <Link
            to={user ? "/profile" : "/login"}
            className="icon-circle-btn"
            aria-label={user ? "Profile" : "Sign In"}
          >
            👤
          </Link>
        </div>
      </div>

      {authoritativeNotice && (
        <div className="authoritative-banner" role="status">
          <span>ℹ️ {authoritativeNotice}</span>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="cart-empty-view">
          <div className="cart-empty-icon" aria-hidden="true">
            🛍️
          </div>
          <h2>Your cart is empty</h2>
          <p>Explore our natural skincare collection and treat your skin.</p>
          <Link to="/products">
            <button className="sole-primary-btn">Explore Skincare</button>
          </Link>
        </div>
      ) : (
        <div className="cart-content-layout">
          {/* Itemized List */}
          <div
            className="cart-items-column"
            role="list"
            aria-label="Shopping cart items"
          >
            {cart.map((item) => {
              const itemId = item._id || item.productId;
              return (
                <div
                  className="sole-cart-item-card"
                  key={itemId}
                  role="listitem"
                >
                  {/* Product Thumbnail in warm beige box */}
                  <div className="cart-item-thumbnail">
                    <SkincareImage
                      name={item.productName}
                      category={item.category}
                      image={item.image}
                    />
                  </div>

                  {/* Right Info */}
                  <div className="cart-item-details">
                    <div className="cart-item-top">
                      <div>
                        <Link
                          to={`/products/${itemId}`}
                          className="cart-item-link"
                          aria-label={`View ${item.productName}`}
                        >
                          <h3 className="cart-item-title">{item.productName}</h3>
                        </Link>
                        <span className="cart-item-category">
                          {item.category || "Skincare"} • {item.size || "50 ml"}
                        </span>
                        {(item.isActive === false || (item.quantity != null && item.quantity <= 0)) && (
                          <span className="cart-item-unavailable-tag" style={{ display: "inline-block", color: "#C0392B", fontSize: "0.78rem", fontWeight: 600, marginTop: "4px" }}>
                            ⚠️ Product currently unavailable
                          </span>
                        )}
                      </div>

                      <button
                        className="cart-remove-icon"
                        onClick={() => setItemToRemove(item)}
                        title={`Remove ${item.productName}`}
                        aria-label={`Remove ${item.productName} from cart`}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="cart-item-bottom">
                      <div className="cart-item-price-block">
                        {item.originalPrice && (
                          <span
                            className="cart-item-orig-price"
                            aria-label="Original price"
                          >
                            {formatINR(item.originalPrice)}
                          </span>
                        )}
                        <span
                          className="cart-item-curr-price"
                          aria-label="Current price"
                        >
                          {formatINR(item.productPrice)}
                        </span>
                      </div>

                      {/* Stepper Pill matching template */}
                      <div
                        className="sole-stepper-pill"
                        role="group"
                        aria-label={`Quantity for ${item.productName}`}
                      >
                        <button
                          className="stepper-btn"
                          onClick={() => updateQty(itemId, item.cartQty - 1)}
                          disabled={item.cartQty <= 1}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span
                          className="stepper-val"
                          aria-live="polite"
                          aria-label={`Quantity: ${item.cartQty}`}
                        >
                          {item.cartQty}
                        </span>
                        <button
                          className="stepper-btn"
                          onClick={() => updateQty(itemId, item.cartQty + 1)}
                          disabled={
                            item.cartQty >=
                            (item.quantity != null ? item.quantity : 99)
                          }
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Breakdown summary */}
          <div
            className="cart-summary-box"
            role="region"
            aria-label="Order summary breakdown"
          >
            <div className="summary-line">
              <span>Delivery:</span>
              <span>
                {totals.delivery === 0 ? "Free" : formatINR(totals.delivery)}
              </span>
            </div>

            <div className="summary-line">
              <span>Discount:</span>
              <span className="discount-green">-{formatINR(totals.discount)}</span>
            </div>

            <div className="summary-line total-before">
              <span>Total:</span>
              <span>{formatINR(totals.itemsSubtotal + totals.delivery)}</span>
            </div>

            <div className="summary-line subtotal-highlight">
              <span>Subtotal:</span>
              <strong>{formatINR(totals.grandTotal)}</strong>
            </div>
          </div>

          {errorMessage && (
            <p className="error center" role="alert">
              {errorMessage}
            </p>
          )}

          {/* Fixed Bottom Checkout Bar matching the template */}
          <div className="cart-sticky-checkout-bar">
            <div className="checkout-price-info">
              <span className="checkout-struck-price" aria-label="Original subtotal">
                {formatINR(totals.itemsSubtotal + totals.delivery)}
              </span>
              <span className="checkout-final-price" aria-label="Final subtotal">
                {formatINR(totals.grandTotal)}
              </span>
            </div>

            <button
              className="checkout-pill-btn"
              onClick={handleProceedToCheckout}
              disabled={loading || cart.length === 0}
              aria-label={
                totals.grandTotal > 0
                  ? `Proceed to checkout for ${formatINR(totals.grandTotal)}`
                  : "Proceed to checkout"
              }
            >
              <span>Proceed to Checkout</span>
              <span className="checkout-btn-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clearing Entire Cart */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Empty Shopping Cart?"
        message="Are you sure you want to remove all items from your cart? This cannot be undone."
        confirmText="Empty Cart"
        cancelText="Keep Items"
        destructive={true}
        onConfirm={handleConfirmClearCart}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Confirmation Modal for Removing Single Item */}
      <ConfirmModal
        isOpen={!!itemToRemove}
        title="Remove Item?"
        message={`Are you sure you want to remove "${itemToRemove?.productName}" from your cart?`}
        confirmText="Remove"
        cancelText="Keep"
        destructive={true}
        onConfirm={handleConfirmRemoveItem}
        onCancel={() => setItemToRemove(null)}
      />
    </div>
  );
}

export default Cart;
