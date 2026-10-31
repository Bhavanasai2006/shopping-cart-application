import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "./ConfirmModal";

function AdminLayout({ children, title, subtitle, actionButton }) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    setShowLogoutConfirm(false);
    await logout();
    showToast({ type: "info", message: "Administrator signed out successfully." });
    navigate("/admin/login");
  }

  return (
    <div className="sole-admin-layout">
      {/* Top Admin Navigation Header */}
      <header className="sole-admin-header" role="banner">
        <div className="admin-header-container">
          <div className="admin-header-brand">
            <Link to="/admin/dashboard" className="admin-brand-link">
              <img src="/sole-logo.png" alt="SOLE Logo" className="admin-brand-icon" />
              <span className="admin-brand-title">SOLE</span>
              <span className="admin-brand-tag">PORTAL</span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="admin-nav-desktop" aria-label="Admin Navigation">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                isActive ? "admin-nav-item active" : "admin-nav-item"
              }
            >
              <span className="admin-nav-icon" aria-hidden="true">📊</span>
              Dashboard
            </NavLink>

            <NavLink
              to="/admin/products"
              end
              className={({ isActive }) =>
                isActive ? "admin-nav-item active" : "admin-nav-item"
              }
            >
              <span className="admin-nav-icon" aria-hidden="true">📦</span>
              Products
            </NavLink>

            <NavLink
              to="/admin/products/new"
              className={({ isActive }) =>
                isActive ? "admin-nav-item active" : "admin-nav-item"
              }
            >
              <span className="admin-nav-icon" aria-hidden="true">➕</span>
              Add Product
            </NavLink>

            <NavLink
              to="/admin/orders"
              className={({ isActive }) =>
                isActive ? "admin-nav-item active" : "admin-nav-item"
              }
            >
              <span className="admin-nav-icon" aria-hidden="true">📑</span>
              Orders
            </NavLink>
          </nav>

          {/* Right Header Controls */}
          <div className="admin-header-right">
            <Link
              to="/products"
              className="admin-secondary-btn"
              title="Switch to customer storefront"
            >
              <span aria-hidden="true">🛍️</span>
              <span className="desktop-only-text">View Shop</span>
            </Link>

            <div className="admin-user-badge" title={`Signed in as ${user?.username} (${user?.emailId})`}>
              <span className="admin-avatar" aria-hidden="true">👤</span>
              <span className="admin-username desktop-only-text">{user?.username || "Admin"}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="admin-logout-btn"
              title="Sign Out of Admin"
              aria-label="Sign out"
            >
              <span aria-hidden="true">🚪</span>
              <span className="desktop-only-text">Logout</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="admin-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close admin menu" : "Open admin menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <nav className="admin-nav-mobile" aria-label="Mobile Admin Navigation">
            <NavLink
              to="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                isActive ? "admin-mobile-item active" : "admin-mobile-item"
              }
            >
              📊 Dashboard
            </NavLink>
            <NavLink
              to="/admin/products"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                isActive ? "admin-mobile-item active" : "admin-mobile-item"
              }
            >
              📦 Products Catalog
            </NavLink>
            <NavLink
              to="/admin/products/new"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                isActive ? "admin-mobile-item active" : "admin-mobile-item"
              }
            >
              ➕ Add New Product
            </NavLink>
            <NavLink
              to="/admin/orders"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                isActive ? "admin-mobile-item active" : "admin-mobile-item"
              }
            >
              📑 Customer Orders
            </NavLink>
            <Link
              to="/products"
              onClick={() => setMobileMenuOpen(false)}
              className="admin-mobile-item store-link"
            >
              🛍️ Return to Customer Shop
            </Link>
          </nav>
        )}
      </header>

      {/* Main Admin Page Container */}
      <main className="admin-main-container">
        {(title || actionButton) && (
          <div className="admin-page-header">
            <div className="admin-page-titles">
              {title && <h1 className="admin-page-heading">{title}</h1>}
              {subtitle && <p className="admin-page-sub">{subtitle}</p>}
            </div>
            {actionButton && <div className="admin-page-actions">{actionButton}</div>}
          </div>
        )}

        <div className="admin-page-content">{children}</div>
      </main>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Admin Sign Out"
        message="Are you sure you want to end your administrative session?"
        confirmText="Sign Out"
        cancelText="Stay Signed In"
        destructive={true}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}

export default AdminLayout;
