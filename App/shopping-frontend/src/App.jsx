import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { useAuth } from "./context/AuthContext";
import CustomerRoute from "./components/CustomerRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";

import Register from "./pages/Register";
import Login from "./pages/Login";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";

// Admin Portal Pages
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProducts from "./pages/AdminProducts";
import AdminProductForm from "./pages/AdminProductForm";
import AdminOrders from "./pages/AdminOrders";

function AppContent() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <div className={`sole-app-wrapper ${isAdminRoute || isAdmin ? "admin-mode" : ""}`}>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      {/* Customer Navbar is strictly hidden from admin users */}
      {!isAdminRoute && !isAdmin && <Navbar />}

      <main
        id="main-content"
        className={isAdminRoute || isAdmin ? "sole-admin-content" : "sole-main-content"}
        tabIndex="-1"
      >
        <Routes>
          <Route
            path="/"
            element={
              isAdmin ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <Navigate to="/products" replace />
              )
            }
          />

          {/* Shop and Product Aliases */}
          <Route
            path="/shop"
            element={
              isAdmin ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <Navigate to="/products" replace />
              )
            }
          />

          {/* Public Customer Auth Routes */}
          <Route
            path="/register"
            element={
              <CustomerRoute>
                <Register />
              </CustomerRoute>
            }
          />
          <Route
            path="/login"
            element={
              <CustomerRoute>
                <Login />
              </CustomerRoute>
            }
          />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Customer Catalog, Product Detail, Cart & Wishlist */}
          <Route
            path="/products"
            element={
              <CustomerRoute>
                <Products />
              </CustomerRoute>
            }
          />
          <Route
            path="/products/:id"
            element={
              <CustomerRoute>
                <ProductDetail />
              </CustomerRoute>
            }
          />
          <Route
            path="/product/:id"
            element={
              <CustomerRoute>
                <ProductDetail />
              </CustomerRoute>
            }
          />
          <Route
            path="/cart"
            element={
              <CustomerRoute>
                <Cart />
              </CustomerRoute>
            }
          />
          <Route
            path="/wishlist"
            element={
              <CustomerRoute>
                <Wishlist />
              </CustomerRoute>
            }
          />

          {/* Protected Customer Routes */}
          <Route
            path="/profile"
            element={
              <CustomerRoute requireAuth>
                <Profile />
              </CustomerRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <CustomerRoute requireAuth>
                <Orders />
              </CustomerRoute>
            }
          />
          <Route
            path="/checkout"
            element={
              <CustomerRoute requireAuth>
                <Checkout />
              </CustomerRoute>
            }
          />
          <Route
            path="/order-success"
            element={
              <CustomerRoute requireAuth>
                <OrderSuccess />
              </CustomerRoute>
            }
          />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={<Navigate to="/admin/dashboard" replace />}
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute adminOnly>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <ProtectedRoute adminOnly>
                <AdminProducts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products/new"
            element={
              <ProtectedRoute adminOnly>
                <AdminProductForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products/edit/:id"
            element={
              <ProtectedRoute adminOnly>
                <AdminProductForm isEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute adminOnly>
                <AdminOrders />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route
            path="*"
            element={
              isAdmin ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <Navigate to="/products" replace />
              )
            }
          />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation is strictly hidden from admin users */}
      {!isAdminRoute && !isAdmin && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
