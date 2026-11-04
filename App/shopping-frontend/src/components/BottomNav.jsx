import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { totalItemCount, wishlistCount } = useCart();

  const isHome = location.pathname === "/" || location.pathname === "/products";
  const isWishlist = location.pathname === "/wishlist";
  const isCart = location.pathname === "/cart";
  const isProfile = location.pathname === "/profile" || location.pathname === "/orders";

  return (
    <nav className="bottom-bar" role="navigation" aria-label="Mobile Navigation">
      <Link
        to="/products"
        className={`bottom-nav-item ${isHome ? "active" : ""}`}
        title="Home"
        aria-label="Home, Skincare Collection"
        aria-current={isHome ? "page" : undefined}
      >
        <span className="bottom-icon" aria-hidden="true">
          ⌂
        </span>
        <span className="bottom-label">Home</span>
      </Link>

      <Link
        to="/wishlist"
        className={`bottom-nav-item ${isWishlist ? "active" : ""}`}
        title="Saved Wishlist"
        aria-label={`Saved Wishlist, ${wishlistCount} items`}
        aria-current={isWishlist ? "page" : undefined}
      >
        <span className="bottom-icon cart-icon-wrap" aria-hidden="true">
          ♡
          {wishlistCount > 0 && (
            <span className="bottom-badge wishlist-badge">{wishlistCount}</span>
          )}
        </span>
        <span className="bottom-label">Saved</span>
      </Link>

      <Link
        to="/cart"
        className={`bottom-nav-item ${isCart ? "active" : ""}`}
        title="Cart"
        aria-label={`Shopping Cart, ${totalItemCount} items`}
        aria-current={isCart ? "page" : undefined}
      >
        <span className="bottom-icon cart-icon-wrap" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
          {totalItemCount > 0 && (
            <span className="bottom-badge">{totalItemCount}</span>
          )}
        </span>
        <span className="bottom-label">Cart</span>
      </Link>

      <Link
        to={user ? "/profile" : "/login"}
        className={`bottom-nav-item ${isProfile ? "active" : ""}`}
        title={user ? "Profile" : "Sign In"}
        aria-label={user ? `Profile (${user.username})` : "Sign In"}
        aria-current={isProfile ? "page" : undefined}
      >
        <span className="bottom-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </span>
        <span className="bottom-label">{user ? "Profile" : "Sign In"}</span>
      </Link>
    </nav>
  );
}

export default BottomNav;
