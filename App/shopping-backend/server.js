// Backward compatibility entry point
const config = require("./config/env");
const { app, connectDB } = require("./controller");

if (require.main === module) {
  const server = app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${config.PORT} is already in use.`);
    } else {
      console.error("Server error:", err.message);
    }
  });

  connectDB().catch((err) => {
    console.error("MongoDB connection warning:", err.message);
  });
}

module.exports = app;
