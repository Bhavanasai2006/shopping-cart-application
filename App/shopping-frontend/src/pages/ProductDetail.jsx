import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API_URL from "../api";
import SkincareImage from "../components/SkincareImage";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { sanitizeErrorMessage } from "../utils/security";
import { formatINR } from "../utils/formatCurrency";

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isInWishlist } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState("description");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_URL}/products/${id}`);

        if (!res.ok) {
          throw new Error("Skincare product not found or unavailable");
        }

        const data = await res.json();
        setProduct(data);
      } catch (err) {
        setError(sanitizeErrorMessage(err, "Failed to load product"));
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchProduct();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="sole-page-container">
        <div className="sole-loading-state" role="status" aria-live="polite">
          <div className="sole-spinner" aria-hidden="true"></div>
          <p>Retrieving authoritative product details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="sole-page-container">
        <div className="cart-empty-view" role="alert">
          <div className="cart-empty-icon" aria-hidden="true">
            🔍
          </div>
          <h2>Product Not Found</h2>
          <p>{error || "We couldn't locate this skincare item."}</p>
          <Link to="/products">
            <button className="sole-primary-btn">Browse Collection</button>
          </Link>
        </div>
      </div>
    );
  }

  const isFavorited = isInWishlist(product._id);
  const isInactive = product?.isActive === false;
  const availableStock = product.quantity != null ? product.quantity : 0;
  const isOutOfStock = availableStock <= 0 || isInactive;

  function handleAddToCart() {
    if (isOutOfStock) return;
    addToCart(product, qty);
    setAdded(true);
    showToast({
      type: "success",
      message: `${qty} × ${product.productName} added to your cart!`
    });
    setTimeout(() => setAdded(false), 1500);
  }

  function handleWishlistToggle() {
    toggleWishlist(product);
    showToast({
      type: "info",
      message: isFavorited
        ? `Removed ${product.productName} from wishlist.`
        : `Saved ${product.productName} to wishlist!`
    });
  }

  return (
    <div className="sole-page-container product-detail-page">
      {/* Breadcrumb / Top Bar */}
      <nav className="detail-page-nav" aria-label="Breadcrumb navigation">
        <button
          className="icon-circle-btn"
          onClick={() => navigate(-1)}
          title="Back"
          aria-label="Back to previous page"
        >
          ‹
        </button>
        <span className="detail-breadcrumb">
          <Link to="/products">Skincare</Link> / {product.category || "General"}
        </span>
        <button
          className={`icon-circle-btn wishlist-icon-btn ${isFavorited ? "active" : ""}`}
          onClick={handleWishlistToggle}
          title={isFavorited ? "Remove from wishlist" : "Save to wishlist"}
          aria-label={
            isFavorited
              ? `Remove ${product.productName} from wishlist`
              : `Save ${product.productName} to wishlist`
          }
        >
          {isFavorited ? "♥" : "♡"}
        </button>
      </nav>

      {/* Main Product Container */}
      <div className="detail-main-layout">
        {/* Botanical Hero Visual Stage */}
        <div className="detail-hero-stage">
          <div className="botanical-daisies" aria-hidden="true">
            <span className="daisy d1">🌼</span>
            <span className="daisy d2">🌸</span>
            <span className="daisy d3">🌼</span>
          </div>
          <SkincareImage
            name={product.productName}
            category={product.category}
            image={product.image}
            className="detail-hero-image"
          />
          <div className="dots-indicator" aria-hidden="true">
            <span className="dot active"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>

        {/* Product Information */}
        <div className="detail-info-section">
          <div className="detail-title-row">
            <h1 className="detail-product-title">{product.productName}</h1>
            <span className="detail-size-badge">{product.size || "50 ml"}</span>
          </div>

          <p className="detail-subtitle">
            {product.subtitle || "Glow Enhancing Botanical Formula"}
          </p>

          {/* Authoritative Stock & Category Pills */}
          <div className="detail-meta-pills" role="group" aria-label="Product attributes">
            <span className="meta-pill category-pill">
              {product.category || "Skincare"}
            </span>
            <span
              className={`meta-pill stock-pill ${
                isOutOfStock
                  ? "stock-out"
                  : availableStock <= 5
                  ? "stock-low"
                  : "stock-in"
              }`}
            >
              {isOutOfStock
                ? "Out of Stock"
                : availableStock <= 5
                ? `Only ${availableStock} left in stock`
                : `In Stock (${availableStock} units)`}
            </span>
          </div>

          {/* Authoritative Price Display */}
          <div className="detail-price-box">
            {product.originalPrice && (
              <span className="detail-struck-price" aria-label="Original price">
                {formatINR(product.originalPrice)}
              </span>
            )}
            <span className="detail-final-price" aria-label="Current price">
              {formatINR(product.productPrice)}
            </span>
          </div>

          {/* Interactive Information Tabs */}
          <div className="detail-tabs" role="tablist" aria-label="Product details">
            <button
              role="tab"
              id="pdetail-tab-desc"
              aria-selected={activeTab === "description"}
              aria-controls="pdetail-panel-desc"
              className={`tab-btn ${activeTab === "description" ? "active" : ""}`}
              onClick={() => setActiveTab("description")}
            >
              Description
            </button>
            <button
              role="tab"
              id="pdetail-tab-use"
              aria-selected={activeTab === "howToUse"}
              aria-controls="pdetail-panel-use"
              className={`tab-btn ${activeTab === "howToUse" ? "active" : ""}`}
              onClick={() => setActiveTab("howToUse")}
            >
              How To Use
            </button>
            <button
              role="tab"
              id="pdetail-tab-ingr"
              aria-selected={activeTab === "ingredients"}
              aria-controls="pdetail-panel-ingr"
              className={`tab-btn ${activeTab === "ingredients" ? "active" : ""}`}
              onClick={() => setActiveTab("ingredients")}
            >
              Ingredients
            </button>
          </div>

          <div className="tab-content">
            <div
              id="pdetail-panel-desc"
              role="tabpanel"
              aria-labelledby="pdetail-tab-desc"
              hidden={activeTab !== "description"}
            >
              <p className="detail-text">
                {product.description ||
                  "Enriched with essential botanicals and vitamins that deeply nourish the skin, restore its natural moisture barrier, and enhance a youthful radiant glow."}
              </p>
            </div>

            <div
              id="pdetail-panel-use"
              role="tabpanel"
              aria-labelledby="pdetail-tab-use"
              hidden={activeTab !== "howToUse"}
            >
              <p className="detail-text">
                {product.howToUse ||
                  "Apply an even layer to freshly cleansed skin. Gently massage in upward circular motions until fully absorbed. Use morning and night for best results."}
              </p>
            </div>

            <div
              id="pdetail-panel-ingr"
              role="tabpanel"
              aria-labelledby="pdetail-tab-ingr"
              hidden={activeTab !== "ingredients"}
            >
              <p className="detail-text ingredients-list">
                {product.ingredients ||
                  "Aqua, Chamomile Extract, Niacinamide, Squalane, Vitamin C (Ascorbyl Glucoside), Vitamin E (Tocopherol), Shea Butter, Botanical Glycerin, Hyaluronic Acid."}
              </p>
            </div>
          </div>

          {/* Quantity Selector & Action Button */}
          <div className="detail-action-controls">
            <div className="sole-stepper-pill detail-stepper" role="group" aria-label="Quantity selector">
              <button
                className="stepper-btn"
                onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                disabled={qty <= 1 || isOutOfStock}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="stepper-val" aria-live="polite" aria-label={`Current quantity: ${qty}`}>
                {qty}
              </span>
              <button
                className="stepper-btn"
                onClick={() =>
                  setQty((prev) => Math.min(availableStock, prev + 1))
                }
                disabled={qty >= availableStock || isOutOfStock}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <button
              className="sole-primary-btn detail-add-btn"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              aria-label={
                isInactive
                  ? "Product Currently Unavailable"
                  : isOutOfStock
                  ? "Out of Stock"
                  : `Add ${qty} to cart for ${formatINR(product.productPrice * qty)}`
              }
            >
              {isInactive
                ? "Currently Unavailable"
                : isOutOfStock
                ? "Out of Stock"
                : added
                ? "✓ Added to Cart"
                : `Add to Cart • ${formatINR(product.productPrice * qty)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
