import { Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";

import Register from "./pages/Register";
import Login from "./pages/Login";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import AdminProducts from "./pages/AdminProducts";

function AppContent() {
  return (
    <div className="sole-app-wrapper">
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      <Navbar />

      <main id="main-content" className="sole-main-content" tabIndex="-1">
        <Routes>
          <Route path="/" element={<Navigate to="/products" replace />} />

          {/* Public Auth Routes */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          {/* Catalog, Product Detail, Cart & Wishlist */}
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />

          {/* Protected Routes (UX Protection + Session checks) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminProducts />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/products" replace />} />
        </Routes>
      </main>

      <BottomNav />
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
