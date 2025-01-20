const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const db = require("./src/config/db"); // Import the database connection
const telegramBot = require("./src/config/bot"); // Import the bot

// Log when the application starts
console.log("Application started...");

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Optional: Start a web server (if needed for health checks or other purposes)
const port = process.env.PORT || 3000;

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Voting Bot is running...");
});

// Start the server
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);

  try {
    // Test the database connection
    await db.testConnection();

    // Initialize the bot
    if (telegramBot.bot) {
      console.log("Telegram bot initialized successfully.");
    } else {
      console.error("Failed to initialize the Telegram bot.");
      process.exit(1); // Exit the application if the bot fails to initialize
    }
  } catch (err) {
    console.error("Failed to start the application:", err);
    process.exit(1); // Exit the application if the database connection fails
  }
});
