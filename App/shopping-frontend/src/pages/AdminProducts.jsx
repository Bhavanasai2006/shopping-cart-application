import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import API_URL from "../api";
import { authFetch } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AdminLayout from "../components/AdminLayout";
import ConfirmModal from "../components/ConfirmModal";
import SkincareImage from "../components/SkincareImage";
import { sanitizeErrorMessage } from "../utils/security";

function AdminProducts() {
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Sorting
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const [sortBy, setSortBy] = useState("name-asc");

  // Deactivation confirmation modal state
  const [deactivatingProduct, setDeactivatingProduct] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (category && category !== "All") params.append("category", category);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (sortBy) params.append("sortBy", sortBy);

      const res = await authFetch(`${API_URL}/admin/products?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load products list");
      }

      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch (err) {
      setError(sanitizeErrorMessage(err, "Could not fetch administrative catalog"));
    } finally {
      setLoading(false);
    }
  }, [search, category, statusFilter, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle Product Deactivation (Soft-Delete)
  async function handleConfirmDeactivate() {
    if (!deactivatingProduct) return;
    setActionInProgress(true);

    try {
      const res = await authFetch(
        `${API_URL}/admin/products/${deactivatingProduct._id}`,
        { method: "DELETE" }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to deactivate product");
      }

      showToast({
        type: "info",
        message: `"${deactivatingProduct.productName}" was safely deactivated.`
      });

      setDeactivatingProduct(null);
      fetchProducts();
    } catch (err) {
      showToast({
        type: "error",
        message: sanitizeErrorMessage(err, "Failed to deactivate product")
      });
    } finally {
      setActionInProgress(false);
    }
  }

  // Handle Product Reactivation
  async function handleReactivate(product) {
    try {
      const res = await authFetch(
        `${API_URL}/admin/products/${product._id}/reactivate`,
        { method: "POST" }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to reactivate product");
      }

      showToast({
        type: "success",
        message: `"${product.productName}" is now active and visible to customers.`
      });

      fetchProducts();
    } catch (err) {
      showToast({
        type: "error",
        message: sanitizeErrorMessage(err, "Failed to reactivate product")
      });
    }
  }

  return (
    <AdminLayout
      title="Product Catalog & Inventory"
      subtitle="Create, edit, restock, or safely deactivate skincare products."
      actionButton={
        <Link to="/admin/products/new" className="sole-primary-btn admin-header-action-btn">
          Add Product
        </Link>
      }
    >
      {error && (
        <div className="auth-error-banner" role="alert">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Controls Card */}
      <div className="admin-controls-card">
        <div className="admin-filter-bar">
          {/* Search Box */}
          <div className="admin-search-wrapper">
            
            <input
              type="search"
              placeholder="Search products by name, description, ingredients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-search-input"
              aria-label="Search products"
            />
          </div>

          {/* Category Filter */}
          <div className="admin-filter-select-group">
            <label htmlFor="category-filter" className="sr-only">Category</label>
            <select
              id="category-filter"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="admin-select"
            >
              <option value="All">All Categories</option>
              <option value="Skincare">Skincare</option>
              <option value="Toner">Toner</option>
              <option value="Serum">Serum</option>
              <option value="Moisturizer">Moisturizer</option>
              <option value="Cleanser">Cleanser</option>
              <option value="Mask">Mask</option>
              <option value="Body Care">Body Care</option>
              <option value="Cosmetic">Cosmetic</option>
            </select>
          </div>

          {/* Sort By Select */}
          <div className="admin-filter-select-group">
            <label htmlFor="sort-filter" className="sr-only">Sort by</label>
            <select
              id="sort-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="admin-select"
            >
              <option value="name-asc">Name (A → Z)</option>
              <option value="name-desc">Name (Z → A)</option>
              <option value="price-asc">Price (Low → High)</option>
              <option value="price-desc">Price (High → Low)</option>
              <option value="stock-asc">Stock (Low → High)</option>
              <option value="stock-desc">Stock (High → Low)</option>
            </select>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="admin-status-tabs" role="tablist" aria-label="Product active status filter">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === "all"}
            className={`admin-tab-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All Products
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === "active"}
            className={`admin-tab-btn ${statusFilter === "active" ? "active" : ""}`}
            onClick={() => setStatusFilter("active")}
          >
            Active Catalog
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === "inactive"}
            className={`admin-tab-btn ${statusFilter === "inactive" ? "active" : ""}`}
            onClick={() => setStatusFilter("inactive")}
          >
            Deactivated / Archived
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="admin-section-card">
        {loading ? (
          <div className="sole-loading-state" role="status" aria-live="polite">
            <div className="sole-spinner" aria-hidden="true"></div>
            <p>Loading catalog inventory...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="admin-empty-state">
            <p className="empty-title">No products match your filter criteria.</p>
            <p className="empty-sub">Try adjusting your search terms, category, or status filter.</p>
            <button
              type="button"
              className="sole-primary-btn"
              onClick={() => {
                setSearch("");
                setCategory("All");
                setStatusFilter("all");
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table" aria-label="Administrator products table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Price</th>
                  <th scope="col">Stock Quantity</th>
                  <th scope="col">Store Status</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isDeactivated = p.isActive === false;
                  return (
                    <tr key={p._id} className={isDeactivated ? "row-deactivated" : ""}>
                      <td className="product-info-cell">
                        <div className="product-thumb-container">
                          <SkincareImage
                            src={p.image}
                            alt={p.productName}
                            category={p.category}
                            className="product-admin-thumb"
                          />
                        </div>
                        <div className="product-text-details">
                          <strong className="product-name-link">
                            <Link to={`/admin/products/edit/${p._id}`}>{p.productName}</Link>
                          </strong>
                          <span className="table-sub">{p.subtitle || p.size || "50 ml"}</span>
                        </div>
                      </td>

                      <td>
                        <span className="category-pill">{p.category || "Skincare"}</span>
                      </td>

                      <td>
                        <div className="price-stack">
                          <strong>${Number(p.productPrice || 0).toFixed(2)}</strong>
                          {p.originalPrice && (
                            <span className="table-sub-strike">
                              ${Number(p.originalPrice).toFixed(2)}
                            </span>
                          )}
                        </div>
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
                          {p.quantity} units
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            !isDeactivated
                              ? "status-pill status-active"
                              : "status-pill status-archived"
                          }
                        >
                          {!isDeactivated ? "Active" : "Deactivated"}
                        </span>
                      </td>

                      <td className="text-right">
                        <div className="admin-table-actions-group">
                          <Link
                            to={`/admin/products/edit/${p._id}`}
                            className="admin-action-btn edit-btn"
                            title="Edit product details & inventory"
                          >
                            Edit
                          </Link>

                          {!isDeactivated ? (
                            <button
                              type="button"
                              onClick={() => setDeactivatingProduct(p)}
                              className="admin-action-btn deactivate-btn"
                              title="Safely deactivate product"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivate(p)}
                              className="admin-action-btn reactivate-btn"
                              title="Reactivate product for customer shop"
                            >
                              ↺ Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Safe Product Deactivation */}
      <ConfirmModal
        isOpen={!!deactivatingProduct}
        title="Deactivate Skincare Product?"
        message={`Are you sure you want to deactivate "${deactivatingProduct?.productName}"? It will be safely hidden from the customer storefront without deleting past customer purchase records.`}
        confirmText="Deactivate Product"
        cancelText="Cancel"
        destructive={true}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivatingProduct(null)}
        disabled={actionInProgress}
      />
    </AdminLayout>
  );
}

export default AdminProducts;
