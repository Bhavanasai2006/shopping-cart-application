import { Link } from "react-router-dom";

function Navbar({ user, cart, logout }) {
  const count = cart.reduce(
    (sum, item) => sum + item.cartQty,
    0
  );

  return (
    <nav className="navbar">
      <Link to="/products" className="logo">
        ShopEase
      </Link>

      <div className="nav-links">
        <Link to="/products">Products</Link>
        <Link to="/cart">Cart ({count})</Link>

        {user ? (
          <>
            <span>Hello, {user.username}</span>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;