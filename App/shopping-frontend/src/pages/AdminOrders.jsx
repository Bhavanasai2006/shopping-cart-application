import { useState, useEffect } from "react";
import API_URL from "../api";
import { authFetch } from "../context/AuthContext";
import AdminLayout from "../components/AdminLayout";
import { sanitizeErrorMessage } from "../utils/security";

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
          <span>Gross Order Revenue:</span>
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
            const orderDate = new Date(order.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });

            return (
              <div key={order._id} className="admin-order-card">
                <div className="admin-order-header">
                  <div className="order-meta-group">
                    <span className="order-id-tag">Order #{String(order._id).slice(-8).toUpperCase()}</span>
                    <span className="order-date-tag">{orderDate}</span>
                  </div>

                  <div className="order-customer-group">
                    <strong>{customerName}</strong>
                    <span className="order-customer-email">({customerEmail})</span>
                  </div>

                  <div className="order-total-badge">
                    <span>Total Paid:</span>
                    <strong>${Number(order.totalAmount || 0).toFixed(2)}</strong>
                  </div>
                </div>

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
                            ${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
