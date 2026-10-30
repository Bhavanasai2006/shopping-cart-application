
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../api";

function Cart({ cart, setCart, user }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const total = cart.reduce(
    (sum, item) => sum + item.productPrice * item.cartQty,
    0
  );

  function updateQty(id, qty) {
    setCart((prev) =>
      prev.map((item) =>
        item._id === id
          ? { ...item, cartQty: qty }
          : item
      )
    );
  }

  function removeItem(id) {
    setCart((prev) => prev.filter((item) => item._id !== id));
  }

  async function checkout() {
    if (!user) {
      navigate("/login");
      return;
    }

    if (cart.length === 0) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: user.userId,
          items: cart.map((item) => ({
            productId: item._id,
            quantity: item.cartQty
          }))
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Checkout failed");
      }

      setCart([]);
      alert("Order placed successfully!");
      navigate("/products");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Your Shopping Cart</h1>

      {cart.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          {cart.map((item) => (
            <div className="cart-item" key={item._id}>
              <div>
                <h3>{item.productName}</h3>
                <p>₹{item.productPrice} each</p>
                <p>
                  Subtotal: ₹
                  {item.productPrice * item.cartQty}
                </p>
              </div>

              <div className="cart-actions">
                <button
                  disabled={item.cartQty <= 1}
                  onClick={() =>
                    updateQty(item._id, item.cartQty - 1)
                  }
                >
                  −
                </button>

                <span>{item.cartQty}</span>

                <button
                  disabled={item.cartQty >= item.quantity}
                  onClick={() =>
                    updateQty(item._id, item.cartQty + 1)
                  }
                >
                  +
                </button>

                <button
                  className="remove-btn"
                  onClick={() => removeItem(item._id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="cart-total">
            <h2>Total: ₹{total}</h2>

            <button
              onClick={checkout}
              disabled={loading}
            >
              {loading ? "Placing Order..." : "Checkout"}
            </button>
          </div>
        </>
      )}

      {message && <p className="error">{message}</p>}
    </div>
  );
}

export default Cart;
