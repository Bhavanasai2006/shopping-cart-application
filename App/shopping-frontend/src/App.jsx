import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Products from "./pages/Products";
import Cart from "./pages/Cart";
import API_URL from "./api";

function App() {
  const [cart, setCart] = useState([]);

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("shopUser");
    return saved ? JSON.parse(saved) : null;
  });

  async function logout() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch {
      // Safe fallback if network error
    }
    localStorage.removeItem("shopUser");
    setUser(null);
    setCart([]);
  }

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find(
        (item) => item._id === product._id
      );

      const currentQty = existing ? existing.cartQty : 0;

      if (currentQty >= product.quantity) {
        alert("No more stock available!");
        return prev;
      }

      if (existing) {
        return prev.map((item) =>
          item._id === product._id
            ? { ...item, cartQty: item.cartQty + 1 }
            : item
        );
      }

      return [...prev, { ...product, cartQty: 1 }];
    });
  }

  return (
    <>
      <Navbar user={user} cart={cart} logout={logout} />

      <Routes>
        <Route
          path="/"
          element={<Navigate to="/products" replace />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/login"
          element={<Login setUser={setUser} />}
        />

        <Route
          path="/products"
          element={
            <Products
              addToCart={addToCart}
              user={user}
            />
          }
        />

        <Route
          path="/cart"
          element={
            <Cart
              cart={cart}
              setCart={setCart}
              user={user}
            />
          }
        />

        <Route
          path="*"
          element={<Navigate to="/products" replace />}
        />
      </Routes>
    </>
  );
}

export default App;
