import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getWishlistStorageKey,
  loadScopedWishlist,
  saveScopedWishlist,
  LEGACY_WISHLIST_KEY,
  GUEST_WISHLIST_KEY
} from "./customerStorage.js";

// Mock localStorage for Node test runner
const storageMap = new Map();
global.window = {
  localStorage: {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear()
  }
};
global.localStorage = global.window.localStorage;

describe("Customer Storage Scoping & Isolation Utilities", () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it("getWishlistStorageKey: generates user-scoped key for customer Angel", () => {
    const angel = { userId: "user-angel-123", username: "Angel", role: "customer" };
    assert.equal(getWishlistStorageKey(angel), "sole_wishlist_user-angel-123");
  });

  it("getWishlistStorageKey: generates separate key for another customer Bob", () => {
    const bob = { userId: "user-bob-456", username: "Bob", role: "customer" };
    assert.equal(getWishlistStorageKey(bob), "sole_wishlist_user-bob-456");
  });

  it("getWishlistStorageKey: returns null for administrators to prevent customer wishlist storage", () => {
    const admin = { userId: "admin-999", username: "Admin", role: "admin" };
    assert.equal(getWishlistStorageKey(admin), null);
  });

  it("getWishlistStorageKey: returns guest key for unauthenticated users", () => {
    assert.equal(getWishlistStorageKey(null), GUEST_WISHLIST_KEY);
  });

  it("loadScopedWishlist: admin receives empty array even if customer wishlist exists", () => {
    const angel = { userId: "user-angel-123", username: "Angel", role: "customer" };
    saveScopedWishlist(angel, [{ productName: "Silk Serum", _id: "prod-1" }]);

    const admin = { userId: "admin-999", username: "Admin", role: "admin" };
    const adminWishlist = loadScopedWishlist(admin);
    assert.deepEqual(adminWishlist, []);
  });

  it("saveScopedWishlist: does not save anything for administrators", () => {
    const admin = { userId: "admin-999", username: "Admin", role: "admin" };
    saveScopedWishlist(admin, [{ productName: "Admin Item", _id: "prod-2" }]);
    assert.equal(storageMap.size, 0);
  });

  it("loadScopedWishlist: migrates legacy un-scoped wishlist for customer Angel without data loss", () => {
    const legacyItems = [{ productName: "Hydrating Cleanser", _id: "prod-cleanser" }];
    storageMap.set(LEGACY_WISHLIST_KEY, JSON.stringify(legacyItems));

    const angel = { userId: "user-angel-123", username: "Angel", role: "customer" };
    const loaded = loadScopedWishlist(angel);

    assert.deepEqual(loaded, legacyItems);
    // Verified migrated to scoped key and removed from legacy
    assert.equal(storageMap.has("sole_wishlist_user-angel-123"), true);
    assert.equal(storageMap.has(LEGACY_WISHLIST_KEY), false);
  });

  it("Account Isolation: Customer Bob cannot see Angel's wishlist", () => {
    const angel = { userId: "user-angel-123", username: "Angel", role: "customer" };
    saveScopedWishlist(angel, [{ productName: "Angel's Cream", _id: "prod-angel" }]);

    const bob = { userId: "user-bob-456", username: "Bob", role: "customer" };
    assert.deepEqual(loadScopedWishlist(bob), []);

    saveScopedWishlist(bob, [{ productName: "Bob's Toner", _id: "prod-bob" }]);

    assert.equal(loadScopedWishlist(angel).length, 1);
    assert.equal(loadScopedWishlist(angel)[0].productName, "Angel's Cream");
    assert.equal(loadScopedWishlist(bob).length, 1);
    assert.equal(loadScopedWishlist(bob)[0].productName, "Bob's Toner");
  });
});
