const mongoose = require("mongoose");
const { User, Product, Order, RefreshToken, Cart } = require("../schema");

// In-memory collections
const store = {
  users: [],
  products: [],
  orders: [],
  refreshTokens: [],
  carts: []
};

function createMongooseDoc(collectionName, data) {
  const id = data._id ? data._id : new mongoose.Types.ObjectId();
  const doc = {
    ...data,
    _id: id,
    id: id.toString(),
    createdAt: data.createdAt || new Date(),
    updatedAt: new Date(),
    async save() {
      const idx = store[collectionName].findIndex(
        (item) => item._id.toString() === id.toString()
      );
      if (idx !== -1) {
        store[collectionName][idx] = this;
      }
      return this;
    },
    async populate(field) {
      if (field === "items.productId" && Array.isArray(this.items)) {
        this.items = this.items.map((item) => {
          const rawId = item.productId?._id || item.productId;
          const found = store.products.find(
            (p) => p._id.toString() === rawId.toString()
          );
          return {
            ...item,
            productId: found || null
          };
        });
      }
      return this;
    },
    toJSON() {
      const copy = { ...this };
      delete copy.password;
      delete copy.verificationToken;
      delete copy.verificationTokenExpires;
      delete copy.passwordResetToken;
      delete copy.passwordResetExpires;
      delete copy.__v;
      return copy;
    },
    toObject() {
      return { ...this };
    }
  };
  return doc;
}

// Intercept Mongoose Model Methods
function setupMockDatabase() {
  // USER MODEL
  User.findOne = async (query) => {
    const raw = store.users.find((u) => {
      for (const [k, v] of Object.entries(query)) {
        if (v && typeof v === "object" && "$gt" in v) {
          if (!(u[k] && new Date(u[k]) > new Date(v.$gt))) return false;
        } else if (u[k] !== v) {
          return false;
        }
      }
      return true;
    });
    if (!raw) return null;
    if (typeof raw.save !== "function") {
      const wrapped = createMongooseDoc("users", raw);
      const idx = store.users.indexOf(raw);
      if (idx !== -1) store.users[idx] = wrapped;
      return wrapped;
    }
    return raw;
  };

  User.findById = async (id) => {
    const raw = store.users.find((u) => u._id.toString() === id.toString());
    if (!raw) return null;
    if (typeof raw.save !== "function") {
      const wrapped = createMongooseDoc("users", raw);
      const idx = store.users.indexOf(raw);
      if (idx !== -1) store.users[idx] = wrapped;
      return wrapped;
    }
    return raw;
  };

  User.create = async (data) => {
    // Check unique email
    if (store.users.some((u) => u.emailId === data.emailId)) {
      const err = new Error("Duplicate key");
      err.code = 11000;
      err.keyPattern = { emailId: 1 };
      throw err;
    }
    const doc = createMongooseDoc("users", data);
    store.users.push(doc);
    return doc;
  };

  User.find = () => {
    const chain = {
      select: () => store.users.map((u) => u.toJSON()),
      then: (resolve) => resolve(store.users.map((u) => u.toJSON()))
    };
    return chain;
  };

  // PRODUCT MODEL
  Product.find = () => {
    const chain = {
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      select: () => store.products,
      then: (resolve) => resolve(store.products)
    };
    return chain;
  };

  Product.findById = async (id) => {
    const p = store.products.find((prod) => prod._id.toString() === id.toString());
    if (!p) return null;
    return {
      ...p,
      select: () => p
    };
  };

  Product.create = async (data) => {
    const doc = createMongooseDoc("products", data);
    store.products.push(doc);
    return doc;
  };

  Product.updateOne = async (query, update) => {
    const p = store.products.find((prod) => {
      if (query._id && prod._id.toString() !== query._id.toString()) return false;
      if (query.quantity && query.quantity.$gte != null) {
        if (prod.quantity < query.quantity.$gte) return false;
      }
      return true;
    });

    if (!p) {
      return { modifiedCount: 0 };
    }

    if (update.$inc && update.$inc.quantity != null) {
      p.quantity += update.$inc.quantity;
    }

    return { modifiedCount: 1 };
  };

  // CART MODEL
  Cart.findOne = async (query) => {
    const raw = store.carts.find((c) => {
      if (query.userId && c.userId.toString() !== query.userId.toString()) return false;
      return true;
    });
    if (!raw) return null;
    if (typeof raw.save !== "function") {
      const wrapped = createMongooseDoc("carts", raw);
      const idx = store.carts.indexOf(raw);
      if (idx !== -1) store.carts[idx] = wrapped;
      return wrapped;
    }
    return raw;
  };

  Cart.create = async (data) => {
    const doc = createMongooseDoc("carts", { items: [], ...data });
    store.carts.push(doc);
    return doc;
  };

  Cart.findOneAndUpdate = async (query, update) => {
    const cart = store.carts.find((c) => {
      if (query.userId && c.userId.toString() !== query.userId.toString()) return false;
      return true;
    });
    if (cart) {
      if (update.$set && update.$set.items) {
        cart.items = update.$set.items;
      }
    }
    return cart || null;
  };

  // ORDER MODEL
  Order.create = async (data) => {
    const doc = createMongooseDoc("orders", data);
    store.orders.push(doc);
    return doc;
  };

  Order.findById = async (id) => {
    return (
      store.orders.find((o) => o._id.toString() === id.toString()) || null
    );
  };

  Order.find = (query = {}) => {
    let filtered = store.orders;
    if (query.userId) {
      filtered = filtered.filter(
        (o) => o.userId.toString() === query.userId.toString()
      );
    }
    const chain = {
      sort: () => filtered,
      then: (resolve) => resolve(filtered)
    };
    return chain;
  };

  Order.findByIdAndDelete = async (id) => {
    const idx = store.orders.findIndex(
      (o) => o._id.toString() === id.toString()
    );
    if (idx !== -1) {
      return store.orders.splice(idx, 1)[0];
    }
    return null;
  };

  // REFRESH TOKEN MODEL
  RefreshToken.create = async (data) => {
    const doc = createMongooseDoc("refreshTokens", data);
    store.refreshTokens.push(doc);
    return doc;
  };

  RefreshToken.findOne = async (query) => {
    return (
      store.refreshTokens.find((r) => {
        for (const [k, v] of Object.entries(query)) {
          if (r[k] !== v) return false;
        }
        return true;
      }) || null
    );
  };

  RefreshToken.updateMany = async (query, update) => {
    let count = 0;
    store.refreshTokens.forEach((r) => {
      let match = true;
      for (const [k, v] of Object.entries(query)) {
        if (r[k] !== v) match = false;
      }
      if (match) {
        Object.assign(r, update);
        count++;
      }
    });
    return { modifiedCount: count };
  };
}

function resetDb() {
  store.users = [];
  store.products = [];
  store.orders = [];
  store.refreshTokens = [];
  store.carts = [];
}

module.exports = {
  store,
  setupMockDatabase,
  resetDb
};
