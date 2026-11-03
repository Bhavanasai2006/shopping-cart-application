import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API_URL from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { sanitizeErrorMessage } from "../utils/security";
import ConfirmModal from "../components/ConfirmModal";
import SkincareImage from "../components/SkincareImage";
import { formatINR } from "../utils/formatCurrency";

function formatStatus(status) {
  switch (status) {
    case "placed":
      return "Order Placed";
    case "processing":
      return "Processing";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "Order Placed";
  }
}

function Orders() {
  const { user, authFetch } = useAuth();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Cancellation State
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await authFetch(`${API_URL}/orders`);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please sign in again to view your orders.");
        }
        if (res.status === 403) {
          throw new Error("Access forbidden: you do not have permission to view these orders.");
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load orders");
      }

      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(sanitizeErrorMessage(err, "Failed to load orders"));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, fetchOrders]);

  async function handleConfirmCancel() {
    if (!orderToCancel) return;

    setCancelling(true);
    try {
      const res = await authFetch(`${API_URL}/orders/${orderToCancel._id}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled by customer via orders dashboard" })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to cancel order");
      }

      showToast({
        type: "info",
        message: `Order #${String(orderToCancel._id).slice(-6).toUpperCase()} has been cancelled and inventory restored.`
      });

      // Update state locally
      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderToCancel._id ? { ...o, status: "cancelled", cancelledAt: new Date() } : o
        )
      );
      setOrderToCancel(null);
    } catch (err) {
      const safeErr = sanitizeErrorMessage(err, "Unable to cancel order");
      showToast({ type: "error", message: safeErr });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="sole-page-container">
      <div className="cart-header-row">
        <Link
          to="/products"
          className="icon-circle-btn"
          title="Back to shop"
          aria-label="Back to shop"
        >
          ‹
        </Link>
        <h1 className="cart-header-title">My Orders</h1>
        <Link
          to="/profile"
          className="icon-circle-btn"
          title="Profile"
          aria-label="View profile"
        >
          👤
        </Link>
      </div>

      {loading ? (
        <div className="sole-loading-state" role="status" aria-live="polite">
          <div className="sole-spinner" aria-hidden="true"></div>
          <p>Loading your orders...</p>
        </div>
      ) : error ? (
        <div className="cart-empty-view" role="alert">
          <div className="cart-empty-icon" aria-hidden="true">⚠</div>
          <h2>Unable to Load Orders</h2>
          <p>{error}</p>
          <button className="sole-primary-btn" onClick={fetchOrders}>
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="cart-empty-view">
          <div className="cart-empty-icon" aria-hidden="true">📦</div>
          <h2>No orders yet</h2>
          <p>When you complete a purchase, your order history and receipt details will appear here.</p>
          <Link to="/products">
            <button className="sole-primary-btn">Discover Products</button>
          </Link>
        </div>
      ) : (
        <div className="orders-list" role="list" aria-label="Order history">
          {orders.map((order) => {
            const currentStatus = order.status || "placed";
            const isEligibleForCancel = currentStatus === "placed" || currentStatus === "processing";

            const formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });

            const addr = order.shippingAddress;

            return (
              <div className="order-card" key={order._id} role="listitem" tabIndex="0">
                <div className="order-header">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span className="order-id">
                        Order #{String(order._id).slice(-8).toUpperCase()}
                      </span>
                      <span className={`order-status-badge status-${currentStatus}`}>
                        ● {formatStatus(currentStatus)}
                      </span>
                    </div>
                    <span className="order-date">{formattedDate}</span>
                  </div>

                  <div className="order-header-right">
                    <div className="order-header-right-badges">
                      <span className="order-demo-pill" title="Demo Transaction — No real money transferred">
                        🛡️ {order.paymentMethod === "DEMO_UPI" ? "Demo UPI" : order.paymentMethod === "DEMO_COD" ? "Demo COD" : "Demo Simulation"}
                        {order.paymentStatus === "demo_refunded" ? " • Refunded" : ""}
                      </span>
                      <div
                        className="order-total-badge"
                        aria-label={`Total amount: ${formatINR(order.totalAmount)}`}
                      >
                        Total: {formatINR(order.totalAmount)}
                      </div>
                    </div>

                    {isEligibleForCancel && (
                      <button
                        className="order-cancel-text-btn"
                        onClick={() => setOrderToCancel(order)}
                        title="Cancel this order and restore stock"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>

                {/* Delivery Address Snapshot */}
                {addr && (
                  <div className="order-address-summary">
                    <span className="address-summary-title">Delivered to:</span>
                    <span className="address-summary-text">
                      {addr.fullName} • {addr.addressLine1}, {addr.city}, {addr.state} {addr.postalCode}
                    </span>
                  </div>
                )}

                {/* Ordered Items List */}
                <div className="order-items" role="list" aria-label="Items in this order">
                  {order.items.map((item, idx) => (
                    <div className="order-item-row" key={idx} role="listitem">
                      <div className="order-item-thumb">
                        <SkincareImage
                          src={item.image}
                          alt={item.productName || "Product"}
                          className="order-item-thumb-img"
                        />
                      </div>
                      <span className="order-item-name">{item.productName || "Skincare Product"}</span>
                      <span className="order-item-qty">Qty: {item.quantity}</span>
                      <span className="order-item-price">
                        {formatINR(item.price)}
                      </span>
                      <span className="order-item-subtotal">
                        {formatINR(item.lineTotal || (item.price * item.quantity))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Order Cancellation */}
      <ConfirmModal
        isOpen={Boolean(orderToCancel)}
        title="Cancel Order"
        message={
          orderToCancel
            ? `Are you sure you want to cancel Order #${String(orderToCancel._id).slice(-6).toUpperCase()}? Your allocated items will be returned to inventory immediately.`
            : ""
        }
        confirmText={cancelling ? "Cancelling..." : "Yes, Cancel Order"}
        cancelText="Keep My Order"
        destructive={true}
        onConfirm={handleConfirmCancel}
        onCancel={() => setOrderToCancel(null)}
      />
    </div>
  );
}

export default Orders;
