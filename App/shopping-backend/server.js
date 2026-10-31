// Backward compatibility entry point
const config = require("./config/env");
const { app, connectDB } = require("./controller");

if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(config.PORT, () => {
        console.log(`Server running on port ${config.PORT}`);
      });
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err.message);
    });
}

module.exports = app;
