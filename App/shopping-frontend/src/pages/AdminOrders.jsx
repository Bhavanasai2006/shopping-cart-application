import { useState, useEffect } from "react";
import API_URL from "../api";
import { authFetch } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AdminLayout from "../components/AdminLayout";
import { sanitizeErrorMessage } from "../utils/security";

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

function AdminOrders() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      setError("");

      try {
        const res = await authFetch(`${API_URL}/admin/orders`);
        if (!res.ok) {
          throw new Error("Failed to load customer orders");
        }
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(sanitizeErrorMessage(err, "Failed to load orders"));
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  async function handleStatusChange(orderId, newStatus) {
    setUpdatingId(orderId);
    try {
      const res = await authFetch(`${API_URL}/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          note: `Status updated to ${newStatus} by admin portal`
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to update order status");
      }

      showToast({
        type: "success",
        message: `Order #${String(orderId).slice(-6).toUpperCase()} status updated to '${formatStatus(newStatus)}'.`
      });

      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      const safeErr = sanitizeErrorMessage(err, "Unable to update status");
      showToast({ type: "error", message: safeErr });
    } finally {
      setUpdatingId(null);
    }
  }

  // Filter orders by ID or customer email/username
  const filteredOrders = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const orderIdMatch = String(o._id).toLowerCase().includes(q);
    const userMatch =
      o.userId &&
      ((o.userId.username && o.userId.username.toLowerCase().includes(q)) ||
        (o.userId.emailId && o.userId.emailId.toLowerCase().includes(q)));
    const productMatch =
      Array.isArray(o.items) &&
      o.items.some(
        (item) => item.productName && item.productName.toLowerCase().includes(q)
      );
    return orderIdMatch || userMatch || productMatch;
  });

  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <AdminLayout
      title="Customer Orders"
      subtitle="Complete record of purchases made across the SOLE customer shop."
    >
      {error && (
        <div className="auth-error-banner" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Orders Summary Bar */}
      <div className="admin-orders-summary-bar">
        <div className="orders-summary-pill">
          <span>Total Orders:</span>
          <strong>{orders.length}</strong>
        </div>
        <div className="orders-summary-pill">
          <span>Gross Order Value:</span>
          <strong>
            ${totalRevenue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </strong>
        </div>

        {/* Filter Input */}
        <div className="admin-search-wrapper" style={{ marginLeft: "auto", maxWidth: "340px" }}>
          <span className="search-icon-symbol" aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="Search by order ID, customer email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-search-input"
            aria-label="Search orders"
          />
        </div>
      </div>

      {loading ? (
        <div className="sole-loading-state" role="status" aria-live="polite">
          <div className="sole-spinner" aria-hidden="true"></div>
          <p>Loading customer order logs...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="admin-section-card">
          <div className="admin-empty-state">
            <p className="empty-title">No orders found.</p>
            <p className="empty-sub">
              {search.trim()
                ? "No customer orders matched your search criteria."
                : "Customer orders will appear here automatically when checkouts are completed."}
            </p>
          </div>
        </div>
      ) : (
        <div className="admin-orders-stack">
          {filteredOrders.map((order) => {
            const customerName = order.userId?.username || "Guest Customer";
            const customerEmail = order.userId?.emailId || "Email unavailable";
            const currentStatus = order.status || "placed";
            const isUpdating = updatingId === order._id;

            const orderDate = new Date(order.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });

            const addr = order.shippingAddress;

            return (
              <div key={order._id} className="admin-order-card">
                <div className="admin-order-header">
                  <div className="order-meta-group">
                    <span className="order-id-tag">
                      Order #{String(order._id).slice(-8).toUpperCase()}
                    </span>
                    <span className={`order-status-badge status-${currentStatus}`}>
                      ● {formatStatus(currentStatus)}
                    </span>
                    <span className="order-date-tag">{orderDate}</span>
                  </div>

                  <div className="order-customer-group">
                    <strong>{customerName}</strong>
                    <span className="order-customer-email">({customerEmail})</span>
                  </div>

                  <div className="order-total-badge">
                    <span>Order Total:</span>
                    <strong>${Number(order.totalAmount || 0).toFixed(2)}</strong>
                  </div>
                </div>

                {/* Shipping Destination */}
                {addr && (
                  <div className="admin-order-shipping-block">
                    <span className="shipping-dest-label">Delivery Destination:</span>
                    <span className="shipping-dest-text">
                      <strong>{addr.fullName}</strong> ({addr.phone}) • {addr.addressLine1}
                      {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}, {addr.city},{" "}
                      {addr.state} {addr.postalCode}, {addr.country || "United States"}
                    </span>
                  </div>
                )}

                {/* Items Table */}
                <div className="admin-order-items-list">
                  <table className="admin-order-items-table" aria-label={`Items in order ${order._id}`}>
                    <thead>
                      <tr>
                        <th scope="col">Skincare Item</th>
                        <th scope="col">Unit Price</th>
                        <th scope="col">Quantity</th>
                        <th scope="col" className="text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.productName || "Skincare Product"}</td>
                          <td>${Number(item.price || 0).toFixed(2)}</td>
                          <td>× {item.quantity}</td>
                          <td className="text-right">
                            ${(Number(item.lineTotal || (item.price * item.quantity)) || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Admin Status Lifecycle Actions */}
                <div className="admin-order-footer">
                  <div className="status-updater-wrap">
                    <label htmlFor={`status-select-${order._id}`} className="status-updater-label">
                      Update Fulfillment Status:
                    </label>
                    <select
                      id={`status-select-${order._id}`}
                      value={currentStatus}
                      disabled={isUpdating || currentStatus === "delivered" || currentStatus === "cancelled"}
                      onChange={(e) => handleStatusChange(order._id, e.target.value)}
                      className="admin-status-select"
                      aria-label="Order status update"
                    >
                      <option value="placed">Order Placed</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled (Restore Stock)</option>
                    </select>
                    {isUpdating && <span className="status-saving-hint">Updating...</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminOrders;
