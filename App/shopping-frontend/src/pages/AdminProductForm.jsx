import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import API_URL from "../api";
import { authFetch } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AdminLayout from "../components/AdminLayout";
import { formatINR } from "../utils/formatCurrency";
import SkincareImage from "../components/SkincareImage";
import { sanitizeErrorMessage, sanitizeImageUrl } from "../utils/security";

const CATEGORIES = [
  "Skincare",
  "Toner",
  "Serum",
  "Moisturizer",
  "Cleanser",
  "Mask",
  "Body Care",
  "Cosmetic"
];

function AdminProductForm({ isEdit = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    productName: "",
    subtitle: "",
    productPrice: "",
    originalPrice: "",
    category: "Skincare",
    size: "50 ml",
    quantity: "25",
    description: "",
    howToUse: "",
    ingredients: "",
    image: "",
    isActive: true
  });

  // Load existing product if in Edit mode
  useEffect(() => {
    if (!isEdit || !id) return;

    async function loadProduct() {
      setLoading(true);
      setError("");

      try {
        const res = await authFetch(`${API_URL}/admin/products/${id}`);
        if (!res.ok) {
          throw new Error("Could not find requested product");
        }
        const data = await res.json();
        setForm({
          productName: data.productName || "",
          subtitle: data.subtitle || "",
          productPrice: data.productPrice != null ? String(data.productPrice) : "",
          originalPrice: data.originalPrice != null ? String(data.originalPrice) : "",
          category: data.category || "Skincare",
          size: data.size || "50 ml",
          quantity: data.quantity != null ? String(data.quantity) : "0",
          description: data.description || "",
          howToUse: data.howToUse || "",
          ingredients: data.ingredients || "",
          image: data.image || "",
          isActive: data.isActive !== false
        });
      } catch (err) {
        setError(sanitizeErrorMessage(err, "Failed to load product details"));
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [isEdit, id]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Front-end validations
    const trimmedName = form.productName.trim();
    if (!trimmedName) {
      setError("Product Name is required.");
      return;
    }

    const price = Number(form.productPrice);
    if (isNaN(price) || price < 0) {
      setError("Product price must be a valid non-negative number.");
      return;
    }

    const qty = Number(form.quantity);
    if (isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
      setError("Stock inventory quantity must be a non-negative whole integer.");
      return;
    }

    let origPrice = null;
    if (form.originalPrice && form.originalPrice.trim() !== "") {
      origPrice = Number(form.originalPrice);
      if (isNaN(origPrice) || origPrice < 0) {
        setError("Original price must be a valid non-negative number if provided.");
        return;
      }
    }

    setSubmitting(true);

    const payload = {
      productName: trimmedName,
      subtitle: form.subtitle.trim(),
      productPrice: price,
      originalPrice: origPrice,
      category: form.category.trim() || "Skincare",
      size: form.size.trim() || "50 ml",
      quantity: qty,
      description: form.description.trim(),
      howToUse: form.howToUse.trim(),
      ingredients: form.ingredients.trim(),
      image: sanitizeImageUrl(form.image.trim()),
      isActive: Boolean(form.isActive)
    };

    try {
      const url = isEdit
        ? `${API_URL}/admin/products/${id}`
        : `${API_URL}/admin/products`;

      const method = isEdit ? "PATCH" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          throw new Error(data.errors.map((e) => e.message).join(", "));
        }
        throw new Error(data.message || `Failed to ${isEdit ? "update" : "create"} product`);
      }

      showToast({
        type: "success",
        message: `Product "${payload.productName}" was successfully ${isEdit ? "updated" : "created"}!`
      });

      navigate("/admin/products");
    } catch (err) {
      setError(sanitizeErrorMessage(err, "Failed to save product"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout
      title={isEdit ? `Edit "${form.productName || 'Product'}"` : "Add New Skincare Product"}
      subtitle={
        isEdit
          ? "Update formulas, prices, inventory count, and visibility."
          : "Publish a new botanical formula into the SOLE luxury catalog."
      }
      actionButton={
        <Link to="/admin/products" className="admin-secondary-btn">
          ← Back to Products
        </Link>
      }
    >
      {loading ? (
        <div className="sole-loading-state" role="status" aria-live="polite">
          <div className="sole-spinner" aria-hidden="true"></div>
          <p>Loading product formula...</p>
        </div>
      ) : (
        <div className="admin-form-split-layout">
          {/* Main Form Card */}
          <div className="admin-form-card">
            {error && (
              <div className="auth-error-banner" role="alert">
                <span aria-hidden="true">!</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="admin-full-form" noValidate>
              <div className="form-field-group">
                <label htmlFor="pname">
                  Product Name <span className="req-star">*</span>
                </label>
                <input
                  id="pname"
                  name="productName"
                  placeholder="e.g. Moisture Repair Cream"
                  value={form.productName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="psub">Subtitle / Formula Focus</label>
                <input
                  id="psub"
                  name="subtitle"
                  placeholder="e.g. Barrier Support & Deep Hydration"
                  value={form.subtitle}
                  onChange={handleChange}
                />
                <small className="field-hint">Displayed under the product title on customer cards.</small>
              </div>

              <div className="form-row-2col">
                <div className="form-field-group">
                  <label htmlFor="pprice">
                    Selling Price (₹) <span className="req-star">*</span>
                  </label>
                  <input
                    id="pprice"
                    name="productPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="₹97"
                    value={form.productPrice}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="porig">Original / Compare-At Price (₹)</label>
                  <input
                    id="porig"
                    name="originalPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="₹110"
                    value={form.originalPrice}
                    onChange={handleChange}
                  />
                  <small className="field-hint">Shows struck-through original price if discounted.</small>
                </div>
              </div>

              <div className="form-row-2col">
                <div className="form-field-group">
                  <label htmlFor="pcategory">Category</label>
                  <select
                    id="pcategory"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="admin-select"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field-group">
                  <label htmlFor="psize">Size / Volume</label>
                  <input
                    id="psize"
                    name="size"
                    placeholder="e.g. 50 ml / 1.7 fl oz"
                    value={form.size}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-field-group">
                <label htmlFor="pqty">
                  Inventory Stock Quantity <span className="req-star">*</span>
                </label>
                <input
                  id="pqty"
                  name="quantity"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="25"
                  value={form.quantity}
                  onChange={handleChange}
                  required
                />
                <small className="field-hint">Authoritative units in stock. Checkout clamps to this quantity.</small>
              </div>

              <div className="form-field-group">
                <label htmlFor="pimage">Product Image URL (Optional)</label>
                <input
                  id="pimage"
                  name="image"
                  type="url"
                  placeholder="https://images.unsplash.com/... or /images/..."
                  value={form.image}
                  onChange={handleChange}
                />
                <small className="field-hint">
                  Leave blank to use SOLE&apos;s luxury procedural skincare botanical illustration.
                </small>
              </div>

              <div className="form-field-group">
                <label htmlFor="pdesc">Product Description</label>
                <textarea
                  id="pdesc"
                  name="description"
                  rows="3"
                  placeholder="Comprehensive botanical benefits, texture and hydration benefits..."
                  value={form.description}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="puse">How to Use</label>
                <textarea
                  id="puse"
                  name="howToUse"
                  rows="2"
                  placeholder="Application rituals and directions for morning and evening..."
                  value={form.howToUse}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="pingr">Full Key Ingredients List</label>
                <textarea
                  id="pingr"
                  name="ingredients"
                  rows="2"
                  placeholder="Botanical extracts, ceramides, hyaluronic acids, vitamins..."
                  value={form.ingredients}
                  onChange={handleChange}
                />
              </div>

              {/* Active Catalog Status Toggle */}
              <div className="admin-checkbox-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={handleChange}
                  />
                  <span>
                    <strong>Active in Store Catalog</strong>
                    <small>When unchecked, product is hidden from customer browsing and search.</small>
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="admin-form-actions">
                <button
                  type="submit"
                  disabled={submitting}
                  className="sole-primary-btn admin-save-btn"
                  aria-label={submitting ? "Saving..." : isEdit ? "Save Product Changes" : "Publish Skincare Product"}
                >
                  {submitting ? (
                    <span className="btn-spinner-wrap">
                      <span className="btn-spinner" aria-hidden="true" />
                      Saving Formula...
                    </span>
                  ) : isEdit ? (
                    "Save Product Changes"
                  ) : (
                    "Publish Product to Catalog"
                  )}
                </button>

                <Link to="/admin/products" className="admin-secondary-btn">
                  Cancel
                </Link>
              </div>
            </form>
          </div>

          {/* Side Preview Card */}
          <aside className="admin-preview-sidebar" aria-label="Live Storefront Preview">
            <div className="admin-preview-card">
              <span className="preview-badge">LIVE STOREFRONT PREVIEW</span>
              <p className="preview-help">How customers will see this item in the store:</p>

              <div className="preview-product-card">
                <div className="preview-img-container">
                  <SkincareImage
                    src={form.image}
                    alt={form.productName || "Preview item"}
                    category={form.category}
                  />
                  {!form.isActive && (
                    <span className="preview-archived-overlay">DEACTIVATED</span>
                  )}
                </div>

                <div className="preview-details">
                  <span className="preview-cat">{form.category || "Skincare"} • {form.size || "50 ml"}</span>
                  <h3 className="preview-title">{form.productName || "Product Name"}</h3>
                  <p className="preview-sub">{form.subtitle || "Formula focus and botanicals"}</p>

                  <div className="preview-price-row">
                    <span className="preview-price">
                      {formatINR(form.productPrice)}
                    </span>
                    {form.originalPrice && (
                      <span className="preview-orig-price">
                        {formatINR(form.originalPrice)}
                      </span>
                    )}
                  </div>

                  <span
                    className={
                      Number(form.quantity) > 5
                        ? "stock-pill stock-in"
                        : Number(form.quantity) > 0
                        ? "stock-pill stock-low"
                        : "stock-pill stock-out"
                    }
                  >
                    {Number(form.quantity) > 0 ? `${form.quantity} in stock` : "Out of stock"}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminProductForm;
