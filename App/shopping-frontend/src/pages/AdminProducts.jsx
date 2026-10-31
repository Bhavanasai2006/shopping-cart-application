import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import API_URL from "../api";
import { useAuth, authFetch } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { sanitizeErrorMessage } from "../utils/security";

function AdminProducts() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    productName: "",
    subtitle: "",
    productPrice: "",
    originalPrice: "",
    category: "Body Care",
    size: "50 ml",
    quantity: "",
    description: "",
    howToUse: "",
    ingredients: ""
  });

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/products");
      return;
    }
    fetchProducts();
  }, [user, navigate]);

  async function fetchProducts() {
    try {
      const res = await fetch(`${API_URL}/products`);
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.productName.trim()) {
      setError("Product name is required.");
      return;
    }

    const price = Number(form.productPrice);
    if (isNaN(price) || price < 0) {
      setError("Please provide a valid price.");
      return;
    }

    const qty = Number(form.quantity);
    if (isNaN(qty) || qty < 0) {
      setError("Please provide a valid inventory stock number.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await authFetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: form.productName.trim(),
          subtitle: form.subtitle.trim(),
          productPrice: price,
          originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
          category: form.category.trim() || "Body Care",
          size: form.size.trim() || "50 ml",
          quantity: qty,
          description: form.description.trim(),
          howToUse: form.howToUse.trim(),
          ingredients: form.ingredients.trim()
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }
        if (res.status === 403) {
          throw new Error("Access forbidden: administrator privileges required.");
        }
        throw new Error(data.message || "Failed to create product");
      }

      showToast({
        type: "success",
        message: `Product "${form.productName}" added to catalog!`
      });

      setForm({
        productName: "",
        subtitle: "",
        productPrice: "",
        originalPrice: "",
        category: "Body Care",
        size: "50 ml",
        quantity: "",
        description: "",
        howToUse: "",
        ingredients: ""
      });

      fetchProducts();
    } catch (err) {
      setError(sanitizeErrorMessage(err, "Failed to add product"));
    } finally {
      setSubmitting(false);
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
        <h1 className="cart-header-title">Admin Catalog</h1>
        <Link
          to="/profile"
          className="icon-circle-btn"
          title="Profile"
          aria-label="Profile"
        >
          👤
        </Link>
      </div>

      <div className="admin-grid">
        {/* Form Card */}
        <div className="admin-card">
          <h2>Add New Skincare Product</h2>

          {error && (
            <div className="auth-error-banner" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-form" noValidate>
            <div className="form-field-group">
              <label htmlFor="admin-pname">Product Name</label>
              <input
                id="admin-pname"
                name="productName"
                placeholder="e.g. Moisture Repair Cream"
                value={form.productName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field-group">
              <label htmlFor="admin-psub">Subtitle / Formula</label>
              <input
                id="admin-psub"
                name="subtitle"
                placeholder="e.g. Barrier Support & Deep Hydration"
                value={form.subtitle}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-field-group">
                <label htmlFor="admin-pprice">Price ($)</label>
                <input
                  id="admin-pprice"
                  name="productPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="97.00"
                  value={form.productPrice}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="admin-porig">Original Price ($) (Optional)</label>
                <input
                  id="admin-porig"
                  name="originalPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="104.00"
                  value={form.originalPrice}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field-group">
                <label htmlFor="admin-pcat">Category</label>
                <select
                  id="admin-pcat"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="admin-select"
                >
                  <option value="Body Care">Body Care</option>
                  <option value="Mask">Mask</option>
                  <option value="Cosmetic">Cosmetic</option>
                  <option value="Serum">Serum</option>
                  <option value="Cleanser">Cleanser</option>
                </select>
              </div>

              <div className="form-field-group">
                <label htmlFor="admin-psize">Size / Volume</label>
                <input
                  id="admin-psize"
                  name="size"
                  placeholder="e.g. 50 ml"
                  value={form.size}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-field-group">
              <label htmlFor="admin-pqty">Stock Inventory</label>
              <input
                id="admin-pqty"
                name="quantity"
                type="number"
                min="0"
                placeholder="25"
                value={form.quantity}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field-group">
              <label htmlFor="admin-pdesc">Description</label>
              <textarea
                id="admin-pdesc"
                name="description"
                rows="3"
                placeholder="Botanical benefits and formula description..."
                value={form.description}
                onChange={handleChange}
              />
            </div>

            <div className="form-field-group">
              <label htmlFor="admin-puse">How To Use</label>
              <textarea
                id="admin-puse"
                name="howToUse"
                rows="2"
                placeholder="Application instructions..."
                value={form.howToUse}
                onChange={handleChange}
              />
            </div>

            <div className="form-field-group">
              <label htmlFor="admin-pingr">Key Ingredients</label>
              <textarea
                id="admin-pingr"
                name="ingredients"
                rows="2"
                placeholder="Full botanical ingredients list..."
                value={form.ingredients}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="sole-primary-btn"
              aria-label={submitting ? "Adding product..." : "Add Product to Catalog"}
            >
              {submitting ? (
                <span className="btn-spinner-wrap">
                  <span className="btn-spinner" aria-hidden="true" />
                  Adding Skincare...
                </span>
              ) : (
                "+ Add Product"
              )}
            </button>
          </form>
        </div>

        {/* Existing Inventory Overview */}
        <div className="admin-card">
          <h2>Current Catalog ({products.length})</h2>

          {loading ? (
            <div className="sole-loading-state">
              <div className="sole-spinner" aria-hidden="true"></div>
              <p>Loading inventory...</p>
            </div>
          ) : products.length === 0 ? (
            <p>No products in the catalog yet.</p>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table" aria-label="Catalog inventory list">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Category</th>
                    <th scope="col">Price</th>
                    <th scope="col">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p._id}>
                      <td className="product-title-cell">
                        <strong>{p.productName}</strong>
                        <div className="table-sub">{p.size || "50 ml"}</div>
                      </td>
                      <td>{p.category || "General"}</td>
                      <td>${Number(p.productPrice || 0).toFixed(2)}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminProducts;
