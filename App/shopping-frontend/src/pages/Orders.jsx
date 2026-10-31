import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API_URL from "../api";
import { useAuth } from "../context/AuthContext";
import { sanitizeErrorMessage } from "../utils/security";

function Orders() {
  const { user, authFetch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        <div
          className="sole-loading-state"
          role="status"
          aria-live="polite"
        >
          <div className="sole-spinner" aria-hidden="true"></div>
          <p>Loading your orders...</p>
        </div>
      ) : error ? (
        <div className="cart-empty-view" role="alert">
          <div className="cart-empty-icon" aria-hidden="true">
            ⚠
          </div>
          <h2>Unable to Load Orders</h2>
          <p>{error}</p>
          <button
            className="sole-primary-btn"
            onClick={fetchOrders}
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="cart-empty-view">
          <div className="cart-empty-icon" aria-hidden="true">
            📦
          </div>
          <h2>No orders yet</h2>
          <p>When you complete a purchase, your order history and receipt details will appear here.</p>
          <Link to="/products">
            <button className="sole-primary-btn">Discover Products</button>
          </Link>
        </div>
      ) : (
        <div
          className="orders-list"
          role="list"
          aria-label="Order history"
        >
          {orders.map((order) => {
            const formattedDate = new Date(order.createdAt).toLocaleDateString(
              "en-US",
              {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              }
            );

            return (
              <div
                className="order-card"
                key={order._id}
                role="listitem"
                tabIndex="0"
              >
                <div className="order-header">
                  <div>
                    <span className="order-id">
                      Order #{order._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="order-date">{formattedDate}</span>
                  </div>
                  <div
                    className="order-total-badge"
                    aria-label={`Total amount: $${Number(order.totalAmount).toFixed(2)}`}
                  >
                    Total: ${Number(order.totalAmount).toFixed(2)}
                  </div>
                </div>

                <div
                  className="order-items"
                  role="list"
                  aria-label="Items in this order"
                >
                  {order.items.map((item, idx) => (
                    <div
                      className="order-item-row"
                      key={idx}
                      role="listitem"
                    >
                      <span className="order-item-name">{item.productName}</span>
                      <span className="order-item-qty">Qty: {item.quantity}</span>
                      <span className="order-item-price">
                        ${Number(item.price).toFixed(2)}
                      </span>
                      <span className="order-item-subtotal">
                        ${Number(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Orders;
