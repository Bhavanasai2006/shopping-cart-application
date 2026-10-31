import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API_URL from "../api";

function Login({ setUser }) {
  const navigate = useNavigate();

  const [emailId, setEmailId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ emailId, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      const loggedInUser = {
        userId: data.userId,
        username: data.username,
        role: data.role || "customer",
        accessToken: data.accessToken
      };

      localStorage.setItem(
        "shopUser",
        JSON.stringify(loggedInUser)
      );

      setUser(loggedInUser);
      navigate("/products");
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Welcome Back</h2>

        <input
          type="email"
          placeholder="Email"
          value={emailId}
          onChange={(e) => setEmailId(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Login</button>

        {message && <p className="error">{message}</p>}

        <p>
          New user? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
