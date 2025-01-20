require("dotenv").config(); // Load environment variables

// Parse admin IDs from .env
const adminIds = process.env.ADMIN_CHAT_ID.split(",").map((id) =>
  parseInt(id.trim(), 10)
);

/**
 * Identifies the user and checks if they're an admin
 * @param {object} msg - Message object from Telegram bot
 * @returns {object} - An object containing the user's name and admin status
 */
function identifyUser(msg) {
  const userId = msg.from.id;
  const isAdmin = adminIds.includes(userId);

  // Get the user's name (default to "Foydalanuvchi" if no first name provided)
  const firstName = msg.from.first_name || "Foydalanuvchi";
  const lastName = msg.from.last_name || ""; // Optional

  // Construct a friendly name
  const friendlyName = lastName ? `${firstName} ${lastName}` : firstName;

  return {
    name: friendlyName,
    isAdmin, // Boolean indicating if the user is an admin
  };
}

module.exports = { identifyUser };
