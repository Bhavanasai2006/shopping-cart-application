
const express = require("express");
const mongoose = require("mongoose");
const { getProducts } = require("./controller");

const app = express();
app.use(express.json());

app.get("/products", getProducts);

const MONGO_URI = "mongodb+srv://subhilogix_db_user:2007@web-tech.um7hzkf.mongodb.net/";

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");

        app.listen(3000, () => {
            console.log("Server running on port 3000");
        });
    })
    .catch((err) => {
        console.log("MongoDB connection failed:", err.message);
    });
