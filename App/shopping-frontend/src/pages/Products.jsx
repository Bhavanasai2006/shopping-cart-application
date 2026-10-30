
import { useEffect, useState } from "react";
import API_URL from "../api";

function Products({ addToCart, user }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`${API_URL}/products`);

        if (!res.ok) {
          throw new Error("Failed to fetch products");
        }

        const data = await res.json();

        // Supports both array and diagnostic API response
        setProducts(Array.isArray(data) ? data : data.products);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  if (loading) return <p className="center">Loading products...</p>;
  if (error) return <p className="center error">{error}</p>;

  return (
    <div className="page">
      <h1>Our Products</h1>

      {!user && (
        <p>Login to checkout and place your order.</p>
      )}

      <div className="product-grid">
        {products.map((product) => (
          <div className="product-card" key={product._id}>
            <div className="product-icon">🛍️</div>

            <h3>{product.productName}</h3>

            <p>{product.description || "Quality product"}</p>

            <h2>₹{product.productPrice}</h2>

            <p>Category: {product.category || "General"}</p>

            <p>
              {product.quantity > 0
                ? `Stock: ${product.quantity}`
                : "Out of stock"}
            </p>

            <button
              disabled={product.quantity <= 0}
              onClick={() => addToCart(product)}
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>

      {products.length === 0 && <p>No products found.</p>}
    </div>
  );
}

export default Products;
