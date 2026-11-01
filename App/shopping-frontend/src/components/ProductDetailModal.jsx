import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import SkincareImage from "./SkincareImage";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { formatINR } from "../utils/formatCurrency";

function ProductDetailModal({ product, onClose, onAddToCart }) {
  const [activeTab, setActiveTab] = useState("description");
  const [added, setAdded] = useState(false);
  const { toggleWishlist, isInWishlist } = useCart();
  const { showToast } = useToast();
  const closeBtnRef = useRef(null);

  // Close modal on Escape key press & focus management
  useEffect(() => {
    closeBtnRef.current?.focus();

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!product) return null;

  const isFavorited = isInWishlist(product._id);
  const isInactive = product?.isActive === false;
  const availableStock = product.quantity != null ? product.quantity : 0;
  const isOutOfStock = availableStock <= 0 || isInactive;

  function handleAdd() {
    if (isOutOfStock) return;
    onAddToCart(product);
    setAdded(true);
    showToast({
      type: "success",
      message: `${product.productName} added to your cart!`
    });
    setTimeout(() => setAdded(false), 1500);
  }

  function handleFavoriteToggle() {
    toggleWishlist(product);
    showToast({
      type: "info",
      message: isFavorited
        ? `Removed ${product.productName} from wishlist.`
        : `Added ${product.productName} to wishlist!`
    });
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-product-title"
      >
        {/* Modal Top Bar */}
        <div className="modal-top-bar">
          <button
            ref={closeBtnRef}
            className="icon-circle-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close product preview"
          >
            ‹
          </button>
          <span className="modal-header-title">{product.productName}</span>
          <button
            className={`icon-circle-btn wishlist-icon-btn ${isFavorited ? "active" : ""}`}
            onClick={handleFavoriteToggle}
            title={isFavorited ? "Remove from wishlist" : "Save to wishlist"}
            aria-label={isFavorited ? "Remove from wishlist" : "Save to wishlist"}
          >
            {isFavorited ? "♥" : "♡"}
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="modal-scrollable">
          {/* Hero Botanical Image Stage */}
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
            {/* Dots Pagination Indicator */}
            <div className="dots-indicator" aria-hidden="true">
              <span className="dot active"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>

          {/* Product Header Info */}
          <div className="detail-info-section">
            <div className="detail-title-row">
              <h1 id="modal-product-title" className="detail-product-title">
                {product.productName}
              </h1>
              <span className="detail-size-badge">{product.size || "50 ml"}</span>
            </div>

            <p className="detail-subtitle">
              {product.subtitle || "Glow Enhancing Botanical Formula"}
            </p>

            <div className="modal-dedicated-link-wrap">
              <Link
                to={`/products/${product._id}`}
                className="modal-full-page-link"
                onClick={onClose}
              >
                Open Full Product Page ↗
              </Link>
            </div>

            {/* Tabs */}
            <div className="detail-tabs" role="tablist" aria-label="Product details">
              <button
                role="tab"
                id="tab-desc"
                aria-selected={activeTab === "description"}
                aria-controls="panel-desc"
                className={`tab-btn ${activeTab === "description" ? "active" : ""}`}
                onClick={() => setActiveTab("description")}
              >
                Description
              </button>
              <button
                role="tab"
                id="tab-use"
                aria-selected={activeTab === "howToUse"}
                aria-controls="panel-use"
                className={`tab-btn ${activeTab === "howToUse" ? "active" : ""}`}
                onClick={() => setActiveTab("howToUse")}
              >
                How To Use
              </button>
              <button
                role="tab"
                id="tab-ingr"
                aria-selected={activeTab === "ingredients"}
                aria-controls="panel-ingr"
                className={`tab-btn ${activeTab === "ingredients" ? "active" : ""}`}
                onClick={() => setActiveTab("ingredients")}
              >
                Ingredients
              </button>
            </div>

            {/* Tab Panels */}
            <div
              id="panel-desc"
              role="tabpanel"
              aria-labelledby="tab-desc"
              hidden={activeTab !== "description"}
              className="detail-tab-content"
            >
              <p>
                {product.description ||
                  "A deeply nourishing formula enriched with essential vitamins and botanical extracts to restore skin radiance, smooth texture, and provide long-lasting hydration."}
              </p>
            </div>

            <div
              id="panel-use"
              role="tabpanel"
              aria-labelledby="tab-use"
              hidden={activeTab !== "howToUse"}
              className="detail-tab-content"
            >
              <p>
                {product.howToUse ||
                  "Apply an even layer to freshly cleansed skin. Gently massage in upward circular motions until absorbed. Use daily, morning and night, for optimal results."}
              </p>
            </div>

            <div
              id="panel-ingr"
              role="tabpanel"
              aria-labelledby="tab-ingr"
              hidden={activeTab !== "ingredients"}
              className="detail-tab-content"
            >
              <p>
                {product.ingredients ||
                  "Aqua (Water), Botanical Vitamin Complex (B3, C, E), Organic Daisy Flower Extract, Jojoba Oil, Hyaluronic Acid, Aloe Vera Leaf Juice, Glycerin, Phenoxyethanol."}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Sticky Bottom Action Bar */}
        <div className="modal-bottom-bar">
          <div className="modal-price-box">
            <span className="price-label">Price</span>
            <div className="price-row">
              {product.originalPrice && (
                <span className="struck-price">
                  {formatINR(product.originalPrice)}
                </span>
              )}
              <span className="current-price">
                {formatINR(product.productPrice)}
              </span>
            </div>
          </div>

          <button
            className={`sole-primary-btn modal-add-btn ${added ? "added-success" : ""}`}
            onClick={handleAdd}
            disabled={isOutOfStock}
            aria-label={
              isInactive
                ? "Product Currently Unavailable"
                : isOutOfStock
                ? "Out of Stock"
                : `Add ${product.productName} to cart for ${formatINR(product.productPrice)}`
            }
          >
            {isInactive
              ? "Currently Unavailable"
              : isOutOfStock
              ? "Out of Stock"
              : added
              ? "✓ Added!"
              : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductDetailModal;
