import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API_URL from "../api";
import { useAuth, authFetch } from "../context/AuthContext";
import AdminLayout from "../components/AdminLayout";
import { sanitizeErrorMessage } from "../utils/security";

function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentProducts, setRecentProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      setError("");

      try {
        const [statsRes, productsRes] = await Promise.all([
          authFetch(`${API_URL}/admin/stats`),
          authFetch(`${API_URL}/admin/products?limit=6`)
        ]);

        if (!statsRes.ok) throw new Error("Failed to load dashboard metrics");
        const statsData = await statsRes.json();
        setStats(statsData.stats || {});

        if (productsRes.ok) {
          const prodData = await productsRes.json();
          setRecentProducts(
            Array.isArray(prodData) ? prodData : prodData.products || []
          );
        }
      } catch (err) {
        setError(sanitizeErrorMessage(err, "Failed to load dashboard data"));
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <AdminLayout
      title={`Welcome back, ${user?.username || "Admin"}`}
      subtitle="Overview of your skincare catalog, store inventory, and recent orders."
      actionButton={
        <Link to="/admin/products/new" className="sole-primary-btn admin-header-action-btn">
          <span>➕</span> Add New Product
        </Link>
      }
    >
      {error && (
        <div className="auth-error-banner" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="sole-loading-state" role="status" aria-live="polite">
          <div className="sole-spinner" aria-hidden="true"></div>
          <p>Loading administrative dashboard...</p>
        </div>
      ) : (
        <>
          {/* Key Metric KPI Cards */}
          <section className="admin-stats-grid" aria-label="Key Performance Metrics">
            <div className="admin-stat-card">
              <div className="stat-card-icon revenue-icon" aria-hidden="true">
                💵
              </div>
              <div className="stat-card-data">
                <span className="stat-label">Total Revenue</span>
                <span className="stat-value">
                  ${Number(stats?.totalRevenue || 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
                <span className="stat-sub">From customer orders</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-card-icon orders-icon" aria-hidden="true">
                📑
              </div>
              <div className="stat-card-data">
                <span className="stat-label">Total Orders</span>
                <span className="stat-value">{stats?.totalOrders || 0}</span>
                <span className="stat-sub">Fulfilled & recorded</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-card-icon products-icon" aria-hidden="true">
                🌿
              </div>
              <div className="stat-card-data">
                <span className="stat-label">Catalog Products</span>
                <span className="stat-value">{stats?.totalProducts || 0}</span>
                <span className="stat-sub">
                  {stats?.activeProducts || 0} active, {stats?.inactiveProducts || 0} archived
                </span>
              </div>
            </div>

            <div className={`admin-stat-card ${stats?.lowStockProducts > 0 ? "warning-highlight" : ""}`}>
              <div className="stat-card-icon alert-icon" aria-hidden="true">
                ⚠️
              </div>
              <div className="stat-card-data">
                <span className="stat-label">Low Stock (≤ 5 units)</span>
                <span className="stat-value">{stats?.lowStockProducts || 0}</span>
                <span className="stat-sub">
                  {stats?.outOfStockProducts || 0} out of stock
                </span>
              </div>
            </div>
          </section>

          {/* Quick Action Navigation Tiles */}
          <section className="admin-quick-actions" aria-label="Quick Actions">
            <h2>Quick Actions</h2>
            <div className="quick-actions-row">
              <Link to="/admin/products/new" className="quick-action-tile">
                <span className="quick-action-icon">➕</span>
                <div className="quick-action-info">
                  <strong>Create Product</strong>
                  <span>Publish new skincare item</span>
                </div>
              </Link>

              <Link to="/admin/products" className="quick-action-tile">
                <span className="quick-action-icon">📦</span>
                <div className="quick-action-info">
                  <strong>Manage Products</strong>
                  <span>Update prices, inventory & status</span>
                </div>
              </Link>

              <Link to="/admin/orders" className="quick-action-tile">
                <span className="quick-action-icon">📑</span>
                <div className="quick-action-info">
                  <strong>Customer Orders</strong>
                  <span>Inspect order details & totals</span>
                </div>
              </Link>
            </div>
          </section>

          {/* Catalog Snapshot Table */}
          <section className="admin-section-card" aria-label="Catalog Snapshot">
            <div className="section-card-header">
              <div>
                <h2>Catalog Inventory Snapshot</h2>
                <p className="section-card-sub">Quick view of live skincare items</p>
              </div>
              <Link to="/admin/products" className="admin-secondary-btn">
                View All Products ({stats?.totalProducts || 0}) →
              </Link>
            </div>

            {recentProducts.length === 0 ? (
              <div className="admin-empty-state">
                <p>No products in the catalog yet.</p>
                <Link to="/admin/products/new" className="sole-primary-btn">
                  + Add Your First Product
                </Link>
              </div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table" aria-label="Recent products inventory">
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Category</th>
                      <th scope="col">Price</th>
                      <th scope="col">Inventory</th>
                      <th scope="col">Status</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentProducts.map((p) => (
                      <tr key={p._id}>
                        <td className="product-title-cell">
                          <strong>{p.productName}</strong>
                          <div className="table-sub">{p.subtitle || p.size || "50 ml"}</div>
                        </td>
                        <td>
                          <span className="category-pill">{p.category || "Skincare"}</span>
                        </td>
                        <td>
                          <strong>${Number(p.productPrice || 0).toFixed(2)}</strong>
                          {p.originalPrice && (
                            <span className="table-sub-strike">
                              {" "}${Number(p.originalPrice).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              p.quantity > 5
                                ? "stock-pill stock-in"
                                : p.quantity > 0
                                ? "stock-pill stock-low"
                                : "stock-pill stock-out"
                            }
                          >
                            {p.quantity} in stock
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              p.isActive !== false
                                ? "status-pill status-active"
                                : "status-pill status-archived"
                            }
                          >
                            {p.isActive !== false ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/admin/products/edit/${p._id}`}
                            className="admin-table-action-link"
                          >
                            ✏️ Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
}

export default AdminDashboard;
