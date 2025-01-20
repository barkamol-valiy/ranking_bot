require("dotenv").config(); // Ensure dotenv is loaded

// Parse ADMIN_IDS from the environment
const adminIds = (process.env.ADMIN_CHAT_ID || "")
  .split(",")
  .map((id) => parseInt(id.trim(), 10));

/**
 * Check if the given user ID is an admin
 * @param {number} userId - Telegram user ID
 * @returns {boolean} - True if user is an admin, otherwise false
 */
const checkAdmin = (userId) => {
  if (!adminIds || adminIds.length === 0) {
    console.warn("No admin IDs configured! Defaulting to non-admin.");
    return false;
  }
  return adminIds.includes(userId);
};

module.exports = checkAdmin;
