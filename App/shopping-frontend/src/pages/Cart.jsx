import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import API_URL from "../api";
import SkincareImage from "../components/SkincareImage";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { sanitizeErrorMessage } from "../utils/security";

function Cart() {
  const { user, authFetch } = useAuth();
  const {
    cart,
    updateQty,
    removeFromCart,
    clearCart,
    totals,
    authoritativeNotice,
    isSyncing,
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

  async function checkout() {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (cart.length === 0) return;

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

      if (itemsPayload.length === 0) {
        await clearCart();
        showToast({
          type: "success",
          message: "Order placed successfully! Thank you for choosing SOLE Skincare."
        });
        navigate("/products");
        return;
      }

      const res = await authFetch(`${API_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          items: itemsPayload
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again to complete your order.");
        }
        if (res.status === 403) {
          throw new Error("Access forbidden: you do not have permission to place this order.");
        }
        throw new Error(data.message || "Checkout failed");
      }

      await clearCart();
      showToast({
        type: "success",
        message: `Order #${data.orderId?.slice(-6).toUpperCase() || ""} placed successfully!`
      });
      navigate("/orders");
    } catch (err) {
      const safeErr = sanitizeErrorMessage(err, "An error occurred during checkout");
      setErrorMessage(safeErr);
      showToast({
        type: "error",
        message: safeErr
      });
    } finally {
      setLoading(false);
    }
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
          My cart {isSyncing && <span className="sync-indicator" aria-label="Syncing with cloud">↻</span>}
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
                            ${Number(item.originalPrice).toFixed(2)}
                          </span>
                        )}
                        <span
                          className="cart-item-curr-price"
                          aria-label="Current price"
                        >
                          ${Number(item.productPrice || 0).toFixed(2)}
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
                {totals.delivery === 0 ? "Free" : `$${totals.delivery.toFixed(2)}`}
              </span>
            </div>

            <div className="summary-line">
              <span>Discount:</span>
              <span className="discount-green">-${totals.discount.toFixed(2)}</span>
            </div>

            <div className="summary-line total-before">
              <span>Total:</span>
              <span>${(totals.itemsSubtotal + totals.delivery).toFixed(2)}</span>
            </div>

            <div className="summary-line subtotal-highlight">
              <span>Subtotal:</span>
              <strong>${totals.grandTotal.toFixed(2)}</strong>
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
                ${(totals.itemsSubtotal + totals.delivery).toFixed(2)}
              </span>
              <span className="checkout-final-price" aria-label="Final subtotal">
                ${totals.grandTotal.toFixed(2)}
              </span>
            </div>

            <button
              className="checkout-pill-btn"
              onClick={checkout}
              disabled={loading}
              aria-label={
                loading
                  ? "Processing order..."
                  : `Proceed to checkout for $${totals.grandTotal.toFixed(2)}`
              }
            >
              {loading ? (
                <span className="btn-spinner-wrap">
                  <span className="btn-spinner" aria-hidden="true" />
                  Processing...
                </span>
              ) : (
                "Checkout"
              )}
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
