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
  // SESSION & TRANSACTION MOCK FOR INTEGRATION TESTS
  let activeSnapshot = null;
  mongoose.startSession = async () => {
    let inTxn = false;
    return {
      startTransaction() {
        inTxn = true;
        // Deep clone current state for rollback simulation
        activeSnapshot = {
          products: store.products.map((p) => ({ ...p, _id: p._id })),
          orders: store.orders.map((o) => ({ ...o, _id: o._id })),
          carts: store.carts.map((c) => ({ ...c, _id: c._id }))
        };
      },
      async commitTransaction() {
        inTxn = false;
        activeSnapshot = null;
      },
      async abortTransaction() {
        inTxn = false;
        if (activeSnapshot) {
          store.products = activeSnapshot.products.map((p) =>
            createMongooseDoc("products", p)
          );
          store.orders = activeSnapshot.orders.map((o) =>
            createMongooseDoc("orders", o)
          );
          store.carts = activeSnapshot.carts.map((c) =>
            createMongooseDoc("carts", c)
          );
          activeSnapshot = null;
        }
      },
      async endSession() {
        inTxn = false;
      },
      inTransaction() {
        return inTxn;
      }
    };
  };

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

  function filterItems(items, query = {}) {
    return items.filter((item) => {
      for (const [k, v] of Object.entries(query)) {
        if (k === "$or" && Array.isArray(v)) {
          const matchOr = v.some((orCondition) => {
            for (const [orK, orV] of Object.entries(orCondition)) {
              if (orV instanceof RegExp) {
                if (orV.test(item[orK] || "")) return true;
              } else if (item[orK] === orV) {
                return true;
              }
            }
            return false;
          });
          if (!matchOr) return false;
        } else if (v && typeof v === "object" && "$ne" in v) {
          if (item[k] === v.$ne) return false;
        } else if (v && typeof v === "object" && ("$gte" in v || "$lte" in v || "$gt" in v)) {
          if (v.$gte != null && item[k] < v.$gte) return false;
          if (v.$lte != null && item[k] > v.$lte) return false;
          if (v.$gt != null && item[k] <= v.$gt) return false;
        } else if (v instanceof RegExp) {
          if (!v.test(item[k] || "")) return false;
        } else if (item[k] !== v) {
          return false;
        }
      }
      return true;
    });
  }

  User.find = () => {
    const chain = {
      select: () => store.users.map((u) => u.toJSON()),
      then: (resolve) => resolve(store.users.map((u) => u.toJSON()))
    };
    return chain;
  };

  User.countDocuments = async (query = {}) => {
    return filterItems(store.users, query).length;
  };

  // PRODUCT MODEL
  Product.find = (query = {}) => {
    const filtered = filterItems(store.products, query);
    const chain = {
      sort: () => chain,
      skip: (n) => {
        const next = filtered.slice(n);
        return {
          limit: (m) => ({
            select: () => next.slice(0, m),
            then: (resolve) => resolve(next.slice(0, m))
          }),
          select: () => next,
          then: (resolve) => resolve(next)
        };
      },
      limit: (m) => ({
        select: () => filtered.slice(0, m),
        then: (resolve) => resolve(filtered.slice(0, m))
      }),
      select: () => filtered,
      then: (resolve) => resolve(filtered)
    };
    return chain;
  };

  Product.countDocuments = async (query = {}) => {
    return filterItems(store.products, query).length;
  };

  Product.findById = async (id) => {
    const raw = store.products.find((prod) => prod._id.toString() === id.toString());
    if (!raw) return null;
    if (typeof raw.save !== "function") {
      const wrapped = createMongooseDoc("products", raw);
      const idx = store.products.indexOf(raw);
      if (idx !== -1) store.products[idx] = wrapped;
      return wrapped;
    }
    return raw;
  };

  Product.findByIdAndDelete = async (id) => {
    const idx = store.products.findIndex((prod) => prod._id.toString() === id.toString());
    if (idx !== -1) {
      return store.products.splice(idx, 1)[0];
    }
    return null;
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
      if (query.isActive != null && query.isActive.$ne != null) {
        if (prod.isActive === query.isActive.$ne) return false;
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
    if (Array.isArray(data)) {
      const docs = data.map((d) => createMongooseDoc("orders", d));
      store.orders.push(...docs);
      return docs;
    }
    const doc = createMongooseDoc("orders", data);
    store.orders.push(doc);
    return doc;
  };

  Order.findById = async (id) => {
    return (
      store.orders.find((o) => o._id.toString() === id.toString()) || null
    );
  };

  Order.countDocuments = async (query = {}) => {
    return filterItems(store.orders, query).length;
  };

  Order.findOne = async (query = {}) => {
    return (
      store.orders.find((o) => {
        if (query["items.productId"]) {
          const targetId = query["items.productId"].toString();
          const hasItem =
            o.items &&
            o.items.some(
              (i) => (i.productId?._id || i.productId).toString() === targetId
            );
          if (!hasItem) return false;
        }
        for (const [k, v] of Object.entries(query)) {
          if (k !== "items.productId" && o[k] !== v) return false;
        }
        return true;
      }) || null
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
      populate: () => chain,
      select: () => chain,
      sort: () => chain,
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
  resetDb,
  createMongooseDoc
};
