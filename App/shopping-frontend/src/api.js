// Frontend API Configuration
// Only public environment variables prefixed with VITE_ are accessed.
// No private secrets, database connection strings, or JWT keys are exposed in frontend code.
const API_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_URL) ||
  "http://localhost:5000/api";

export default API_URL;
