function ProductSkeleton({ count = 6 }) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div
      className="sole-products-grid skeleton-grid"
      aria-busy="true"
      aria-label="Loading products"
    >
      {items.map((key) => (
        <div className="sole-product-card skeleton-card" key={key}>
          <div className="skeleton-image-wrap shimmer" />
          <div className="skeleton-info-wrap">
            <div className="skeleton-line shimmer title-line" />
            <div className="skeleton-line shimmer subtitle-line" />
            <div className="skeleton-bottom-row">
              <div className="skeleton-line shimmer price-line" />
              <div className="skeleton-circle shimmer add-btn-line" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ProductSkeleton;

