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
          <img src="/sole-logo.png" alt="SOLE Logo" className="sole-brand-icon" />
          <span className="sole-brand-text">SOLE</span>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </Link>

          <Link
            to="/cart"
            className="sole-icon-btn sole-cart-btn"
            title="View Cart"
            aria-label={`Shopping Cart, ${totalItemCount} items`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
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
              <span className="drawer-logo">
                <img src="/sole-logo.png" alt="SOLE Logo" className="drawer-logo-icon" />
                <span>SOLE</span>
              </span>
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
