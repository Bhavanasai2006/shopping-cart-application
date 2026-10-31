import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "./ConfirmModal";

function Navbar({ onSearchToggle }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { user, logout } = useAuth();
  const { totalItemCount, wishlistCount } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Close drawer on Escape key press
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  async function handleLogout() {
    setShowLogoutConfirm(false);
    await logout();
    setMenuOpen(false);
    showToast({ type: "info", message: "You have signed out of your account." });
    navigate("/products");
  }

  return (
    <>
      <header className="sole-navbar" role="banner">
        {/* Left: Hamburger Icon */}
        <button
          className="sole-icon-btn menu-toggle-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="drawer-navigation"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Center: Brand Logo */}
        <Link to="/products" className="sole-brand-logo" aria-label="SOLE Home">
          SOLE
        </Link>

        {/* Right Actions */}
        <div className="sole-header-actions">
          {onSearchToggle && (
            <button
              className="sole-icon-btn"
              onClick={onSearchToggle}
              title="Search skincare"
              aria-label="Search skincare products"
            >
              🔍
            </button>
          )}

          <Link
            to="/wishlist"
            className="sole-icon-btn sole-wishlist-nav-btn"
            title="Wishlist"
            aria-label={`Wishlist, ${wishlistCount} items`}
          >
            ♡
            {wishlistCount > 0 && (
              <span className="sole-wishlist-badge" aria-hidden="true">
                {wishlistCount}
              </span>
            )}
          </Link>

          <Link
            to={user ? "/profile" : "/login"}
            className="sole-icon-btn"
            title={user ? `Profile (${user.username})` : "Sign In"}
            aria-label={user ? `Profile (${user.username})` : "Sign In"}
          >
            {user ? "👤" : "🔑"}
          </Link>

          <Link
            to="/cart"
            className="sole-icon-btn sole-cart-btn"
            title="View Cart"
            aria-label={`Shopping Cart, ${totalItemCount} items`}
          >
            🛒
            {totalItemCount > 0 && (
              <span className="sole-cart-badge" aria-hidden="true">
                {totalItemCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Slide-out Drawer */}
      {menuOpen && (
        <div
          className="drawer-overlay"
          onClick={() => setMenuOpen(false)}
          role="presentation"
        >
          <div
            id="drawer-navigation"
            className="drawer-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Site Navigation"
          >
            <div className="drawer-header">
              <span className="drawer-logo">SOLE</span>
              <button
                className="drawer-close-btn"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <nav className="drawer-nav">
              <Link to="/products" onClick={() => setMenuOpen(false)}>
                Skincare Collection
              </Link>
              <Link to="/cart" onClick={() => setMenuOpen(false)}>
                My Cart ({totalItemCount})
              </Link>
              <Link to="/wishlist" onClick={() => setMenuOpen(false)}>
                My Wishlist ({wishlistCount})
              </Link>

              {user ? (
                <>
                  <Link to="/profile" onClick={() => setMenuOpen(false)}>
                    My Profile
                  </Link>

                  <Link to="/orders" onClick={() => setMenuOpen(false)}>
                    My Orders
                  </Link>

                  {user.role === "admin" && (
                    <Link
                      to="/admin/dashboard"
                      className="admin-link-highlight"
                      onClick={() => setMenuOpen(false)}
                    >
                      ★ Admin Dashboard
                    </Link>
                  )}

                  <div className="drawer-user-info">
                    <p>
                      Logged in as <strong>{user.username}</strong>
                    </p>
                    <button
                      className="drawer-logout-btn"
                      onClick={() => setShowLogoutConfirm(true)}
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              ) : (
                <div className="drawer-auth-links">
                  <Link
                    to="/login"
                    className="drawer-login-btn"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="drawer-register-btn"
                    onClick={() => setMenuOpen(false)}
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Sign Out */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of your SOLE account?"
        confirmText="Sign Out"
        cancelText="Stay Signed In"
        destructive={true}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}

export default Navbar;
