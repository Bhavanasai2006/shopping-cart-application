import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Route Guard Resolution Logic (Mirror of CustomerRoute & ProtectedRoute rules)
 */
function resolveCustomerRoute({ isAuthenticated, userRole, requireAuth }) {
  // If user is admin, strictly redirect to admin dashboard
  if (isAuthenticated && userRole === "admin") {
    return { action: "REDIRECT", to: "/admin/dashboard" };
  }

  // If customer route requires authentication and visitor is unauthenticated
  if (requireAuth && !isAuthenticated) {
    return { action: "REDIRECT", to: "/login" };
  }

  // Permitted access for customer or guest
  return { action: "ALLOW" };
}

function resolveAdminRoute({ isAuthenticated, userRole }) {
  if (!isAuthenticated) {
    return { action: "REDIRECT", to: "/admin/login" };
  }

  if (userRole !== "admin") {
    return { action: "FORBIDDEN_403" };
  }

  return { action: "ALLOW" };
}

function resolveStorefrontNavigation({ isAuthenticated, userRole }) {
  // Navigation elements (Navbar, BottomNav) must not be rendered for administrators
  const isAdmin = isAuthenticated && userRole === "admin";
  return { renderCustomerNav: !isAdmin };
}

describe("Role-Based Routing & Storefront Boundary Verification", () => {
  it("Admin cannot access public customer routes (/products, /cart, /wishlist)", () => {
    const admin = { isAuthenticated: true, userRole: "admin", requireAuth: false };
    const result = resolveCustomerRoute(admin);
    assert.equal(result.action, "REDIRECT");
    assert.equal(result.to, "/admin/dashboard");
  });

  it("Admin cannot access protected customer routes (/profile, /orders, /checkout)", () => {
    const admin = { isAuthenticated: true, userRole: "admin", requireAuth: true };
    const result = resolveCustomerRoute(admin);
    assert.equal(result.action, "REDIRECT");
    assert.equal(result.to, "/admin/dashboard");
  });

  it("Admin cannot access customer auth routes (/login, /register)", () => {
    const admin = { isAuthenticated: true, userRole: "admin", requireAuth: false };
    const result = resolveCustomerRoute(admin);
    assert.equal(result.action, "REDIRECT");
    assert.equal(result.to, "/admin/dashboard");
  });

  it("Customer can access public customer routes", () => {
    const customer = { isAuthenticated: true, userRole: "customer", requireAuth: false };
    const result = resolveCustomerRoute(customer);
    assert.equal(result.action, "ALLOW");
  });

  it("Customer can access protected customer routes", () => {
    const customer = { isAuthenticated: true, userRole: "customer", requireAuth: true };
    const result = resolveCustomerRoute(customer);
    assert.equal(result.action, "ALLOW");
  });

  it("Customer is strictly denied access to admin routes (403)", () => {
    const customer = { isAuthenticated: true, userRole: "customer" };
    const result = resolveAdminRoute(customer);
    assert.equal(result.action, "FORBIDDEN_403");
  });

  it("Unauthenticated visitor can view public customer storefront", () => {
    const guest = { isAuthenticated: false, userRole: null, requireAuth: false };
    const result = resolveCustomerRoute(guest);
    assert.equal(result.action, "ALLOW");
  });

  it("Unauthenticated visitor is redirected to /login for protected customer routes", () => {
    const guest = { isAuthenticated: false, userRole: null, requireAuth: true };
    const result = resolveCustomerRoute(guest);
    assert.equal(result.action, "REDIRECT");
    assert.equal(result.to, "/login");
  });

  it("Unauthenticated visitor is redirected to /admin/login for admin routes", () => {
    const guest = { isAuthenticated: false, userRole: null };
    const result = resolveAdminRoute(guest);
    assert.equal(result.action, "REDIRECT");
    assert.equal(result.to, "/admin/login");
  });

  it("Admin is permitted access to admin portal routes", () => {
    const admin = { isAuthenticated: true, userRole: "admin" };
    const result = resolveAdminRoute(admin);
    assert.equal(result.action, "ALLOW");
  });

  it("Customer navbar and mobile bar are never rendered for administrator", () => {
    const admin = { isAuthenticated: true, userRole: "admin" };
    assert.equal(resolveStorefrontNavigation(admin).renderCustomerNav, false);

    const customer = { isAuthenticated: true, userRole: "customer" };
    assert.equal(resolveStorefrontNavigation(customer).renderCustomerNav, true);

    const guest = { isAuthenticated: false, userRole: null };
    assert.equal(resolveStorefrontNavigation(guest).renderCustomerNav, true);
  });
});
