import { Link } from "react-router-dom";
import SkincareImage from "../components/SkincareImage";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

function Wishlist() {
  const { wishlist, removeFromWishlist, moveToCart } = useCart();
  const { showToast } = useToast();

  function handleMoveToCart(item) {
    moveToCart(item);
    showToast({
      type: "success",
      message: `${item.productName} moved to cart!`
    });
  }

  function handleRemove(item) {
    removeFromWishlist(item._id);
    showToast({
      type: "info",
      message: `${item.productName} removed from wishlist.`
    });
  }

  return (
    <div className="sole-page-container">
      {/* Top Header */}
      <div className="cart-header-row">
        <Link
          to="/products"
          className="icon-circle-btn"
          title="Back to shop"
          aria-label="Back to shop"
        >
          ‹
        </Link>
        <h1 className="cart-header-title">My Wishlist ({wishlist.length})</h1>
        <Link
          to="/cart"
          className="icon-circle-btn"
          title="Cart"
          aria-label="View shopping cart"
        >
          🛒
        </Link>
      </div>

      {wishlist.length === 0 ? (
        <div className="cart-empty-view">
          <div className="cart-empty-icon" aria-hidden="true">
            ♡
          </div>
          <h2>Your wishlist is empty</h2>
          <p>
            Tap the heart icon on any skincare product to save it here for later.
          </p>
          <Link to="/products">
            <button className="sole-primary-btn">Explore Skincare</button>
          </Link>
        </div>
      ) : (
        <div
          className="wishlist-grid"
          role="list"
          aria-label="Saved wishlist items"
        >
          {wishlist.map((item) => (
            <div
              className="sole-cart-item-card wishlist-card"
              key={item._id}
              role="listitem"
            >
              {/* Product Thumbnail */}
              <div className="cart-item-thumbnail">
                <SkincareImage
                  name={item.productName}
                  category={item.category}
                  image={item.image}
                />
              </div>

              {/* Details */}
              <div className="cart-item-details">
                <div className="cart-item-top">
                  <div>
                    <Link
                      to={`/products/${item._id}`}
                      className="wishlist-item-title-link"
                      aria-label={`View ${item.productName}`}
                    >
                      <h3 className="cart-item-title">{item.productName}</h3>
                    </Link>
                    <span className="cart-item-category">
                      {item.category || "Skincare"} • {item.size || "50 ml"}
                    </span>
                  </div>

                  <button
                    className="cart-remove-icon"
                    onClick={() => handleRemove(item)}
                    title="Remove from wishlist"
                    aria-label={`Remove ${item.productName} from wishlist`}
                  >
                    ✕
                  </button>
                </div>

                <div className="wishlist-bottom-row">
                  <div className="cart-item-price-block">
                    {item.originalPrice && (
                      <span
                        className="cart-item-orig-price"
                        aria-label="Original price"
                      >
                        ${Number(item.originalPrice).toFixed(2)}
                      </span>
                    )}
                    <span
                      className="cart-item-curr-price"
                      aria-label="Current price"
                    >
                      ${Number(item.productPrice || 0).toFixed(2)}
                    </span>
                  </div>

                  <button
                    className="wishlist-move-btn"
                    onClick={() => handleMoveToCart(item)}
                    aria-label={`Move ${item.productName} to cart`}
                  >
                    Move to Cart →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Wishlist;
