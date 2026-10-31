import { useEffect, useState, useCallback } from "react";
import API_URL from "../api";
import SkincareImage from "../components/SkincareImage";
import ProductDetailModal from "../components/ProductDetailModal";
import ProductSkeleton from "../components/ProductSkeleton";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

const CATEGORIES = ["All", "Body Care", "Mask", "Cosmetic", "Serum", "Cleanser"];

function Products() {
  const { addToCart, toggleWishlist, isInWishlist } = useCart();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [showFilters, setShowFilters] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  const ITEMS_PER_PAGE = 6;

  // Close search and filters on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        if (previewProduct) {
          setPreviewProduct(null);
        } else if (showSearch) {
          setShowSearch(false);
        } else if (showFilters) {
          setShowFilters(false);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewProduct, showSearch, showFilters]);

  // -------------------------------------------------------------
  // Authoritative Backend Fetch with Search, Filters, Sort, Page
  // -------------------------------------------------------------
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "All") {
        params.append("category", selectedCategory);
      }
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      if (minPrice !== "" && !isNaN(Number(minPrice))) {
        params.append("minPrice", minPrice);
      }
      if (maxPrice !== "" && !isNaN(Number(maxPrice))) {
        params.append("maxPrice", maxPrice);
      }
      if (sortBy) {
        params.append("sortBy", sortBy);
      }
      params.append("page", String(page));
      params.append("limit", String(ITEMS_PER_PAGE));

      const res = await fetch(`${API_URL}/products?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load products");

      const data = await res.json();

      if (data && typeof data === "object" && !Array.isArray(data) && data.products) {
        setProducts(data.products);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || data.products.length);
      } else if (Array.isArray(data)) {
        setProducts(data);
        setTotalPages(1);
        setTotalItems(data.length);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, minPrice, maxPrice, sortBy, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleCategoryClick(cat) {
    setSelectedCategory(cat);
    setPage(1);
  }

  function handleResetFilters() {
    setSelectedCategory("All");
    setSearchQuery("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("newest");
    setPage(1);
  }

  function handleAddToCartClick(product, e) {
    e.stopPropagation();
    addToCart(product, 1);
    showToast({
      type: "success",
      message: `${product.productName} added to your cart!`
    });
  }

  function handleWishlistClick(product, e) {
    e.stopPropagation();
    const isFav = isInWishlist(product._id);
    toggleWishlist(product);
    showToast({
      type: "info",
      message: isFav
        ? `Removed ${product.productName} from wishlist.`
        : `Saved ${product.productName} to wishlist!`
    });
  }

  const hasActiveFilters =
    selectedCategory !== "All" ||
    searchQuery !== "" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    sortBy !== "newest";

  return (
    <div className="sole-page-container">
      {/* Hero Headline */}
      <div className="sole-hero-header">
        <h1 className="sole-hero-title">
          Natural care for
          <br />
          healthy skin
        </h1>

        <div className="hero-action-buttons">
          <button
            className={`sole-search-toggle-btn ${showSearch ? "active" : ""}`}
            onClick={() => setShowSearch(!showSearch)}
            title="Search skincare"
            aria-label="Toggle search bar"
            aria-expanded={showSearch}
          >
            🔍
          </button>
          <button
            className={`sole-filter-toggle-btn ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Filter by price & sort"
            aria-label="Toggle filters and sorting"
            aria-expanded={showFilters}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Expandable Search Input */}
      {showSearch && (
        <div className="sole-search-container" role="search">
          <label htmlFor="catalog-search" className="visually-hidden">
            Search skincare collection
          </label>
          <input
            id="catalog-search"
            type="text"
            placeholder="Search serums, masks, moisturizers..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="sole-search-input"
            autoFocus
          />
          {searchQuery && (
            <button
              className="sole-search-clear"
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              aria-label="Clear search text"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Category Pills (Horizontal Scroll) */}
      <div
        className="sole-category-scroll"
        role="group"
        aria-label="Filter by category"
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              className={`sole-cat-pill ${isSelected ? "active" : ""}`}
              onClick={() => handleCategoryClick(isSelected && cat !== "All" ? "All" : cat)}
              aria-pressed={isSelected}
            >
              <span>{cat}</span>
              {isSelected && cat !== "All" && (
                <span className="pill-x" aria-hidden="true">
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Advanced Filter & Sorting Panel (Expandable) */}
      {showFilters && (
        <div className="sole-filter-panel" role="region" aria-label="Filters">
          <div className="filter-panel-header">
            <h3>Refine Collection</h3>
            {hasActiveFilters && (
              <button className="filter-reset-link" onClick={handleResetFilters}>
                Reset all
              </button>
            )}
          </div>

          <div className="filter-panel-grid">
            {/* Sorting Dropdown */}
            <div className="filter-group">
              <label htmlFor="sort-dropdown">Sort By</label>
              <select
                id="sort-dropdown"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="newest">Featured & Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Alphabetical (A - Z)</option>
                <option value="name-desc">Alphabetical (Z - A)</option>
              </select>
            </div>

            {/* Price Range Filter */}
            <div className="filter-group">
              <label htmlFor="min-price-filter">Price Range ($)</label>
              <div className="price-inputs-row">
                <input
                  id="min-price-filter"
                  type="number"
                  min="0"
                  placeholder="Min ($)"
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(e.target.value);
                    setPage(1);
                  }}
                  className="price-filter-input"
                  aria-label="Minimum price in dollars"
                />
                <span className="price-separator" aria-hidden="true">
                  –
                </span>
                <input
                  id="max-price-filter"
                  type="number"
                  min="0"
                  placeholder="Max ($)"
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value);
                    setPage(1);
                  }}
                  className="price-filter-input"
                  aria-label="Maximum price in dollars"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Count and Active Filters info */}
      <div className="catalog-meta-bar">
        <span className="results-count">
          Showing {products.length} {totalItems ? `of ${totalItems}` : ""} items
        </span>
        {hasActiveFilters && (
          <button className="clear-pills-link" onClick={handleResetFilters}>
            Clear filters
          </button>
        )}
      </div>

      {/* Product Grid / Skeleton */}
      {loading ? (
        <ProductSkeleton count={6} />
      ) : products.length === 0 ? (
        <div className="cart-empty-view sole-empty-results">
          <div className="cart-empty-icon" aria-hidden="true">
            🔍
          </div>
          <h2>No skincare products found</h2>
          <p>We couldn't find any products matching your active filters or search.</p>
          <button
            className="sole-primary-btn"
            onClick={handleResetFilters}
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="sole-product-grid">
          {products.map((product) => {
            const isFav = isInWishlist(product._id);
            const isOutOfStock = product.quantity != null && product.quantity <= 0;

            return (
              <div
                className="sole-product-card"
                key={product._id}
                tabIndex="0"
                role="button"
                aria-label={`View details for ${product.productName}`}
                onClick={() => setPreviewProduct(product)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPreviewProduct(product);
                  }
                }}
              >
                {/* Wishlist Button on Top Right */}
                <button
                  className={`card-wishlist-toggle ${isFav ? "active" : ""}`}
                  onClick={(e) => handleWishlistClick(product, e)}
                  title={isFav ? "Saved to wishlist" : "Save to wishlist"}
                  aria-label={
                    isFav
                      ? `Remove ${product.productName} from wishlist`
                      : `Save ${product.productName} to wishlist`
                  }
                >
                  {isFav ? "♥" : "♡"}
                </button>

                {/* Product Title at Top */}
                <div className="card-top-info">
                  <h3 className="sole-card-name">{product.productName}</h3>
                  <span className="sole-card-size">{product.size || "50 ml"}</span>
                </div>

                {/* Centered Product Visual */}
                <div className="card-img-stage">
                  <SkincareImage
                    name={product.productName}
                    category={product.category}
                    image={product.image}
                    className="card-skincare-img"
                  />
                </div>

                {/* Card Footer: Price & Add Button */}
                <div className="sole-card-footer">
                  <div className="sole-price-stack">
                    {product.originalPrice && (
                      <span className="sole-original-price">
                        ${Number(product.originalPrice).toFixed(2)}
                      </span>
                    )}
                    <span className="sole-current-price">
                      ${Number(product.productPrice || 0).toFixed(2)}
                    </span>
                    {isOutOfStock && (
                      <span className="card-stock-warning">Out of stock</span>
                    )}
                  </div>

                  <button
                    className="sole-card-add-btn"
                    onClick={(e) => handleAddToCartClick(product, e)}
                    disabled={isOutOfStock}
                    title={isOutOfStock ? "Sold out" : "Add to cart"}
                    aria-label={
                      isOutOfStock
                        ? "Out of stock"
                        : `Add ${product.productName} to cart`
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Authoritative Pagination Controls */}
      {totalPages > 1 && (
        <nav
          className="sole-pagination-container"
          aria-label="Product pagination"
        >
          <button
            className="pagination-arrow-btn"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            aria-label="Previous page"
          >
            ‹ Prev
          </button>

          <span className="pagination-info" aria-current="page">
            Page {page} of {totalPages}
          </span>

          <button
            className="pagination-arrow-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            aria-label="Next page"
          >
            Next ›
          </button>
        </nav>
      )}

      {/* Quick Modal Preview */}
      {previewProduct && (
        <ProductDetailModal
          product={previewProduct}
          onClose={() => setPreviewProduct(null)}
          onAddToCart={(p) => addToCart(p, 1)}
        />
      )}
    </div>
  );
}

export default Products;
