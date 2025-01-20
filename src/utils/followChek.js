// src/utils/followCheck.js
const Channel = require("../models/Channels"); // Import the Channel model

class FollowCheck {
  // Check if the user follows the required channel
  static async isFollowingChannel(bot, userId) {
    try {
      // Fetch the required channel ID from the database
      const requiredChannel = await Channel.findRequiredChannel();
      if (!requiredChannel) {
        throw new Error("Required channel not found in the database.");
      }

      const chatId = requiredChannel.channel_id;

      // Check if the user is a member, admin, or creator of the channel
      const member = await bot.getChatMember(chatId, userId);
      return (
        member.status === "member" ||
        member.status === "administrator" ||
        member.status === "creator"
      );
    } catch (err) {
      console.error("Error checking channel membership:", err);
      return false;
    }
  }
}

module.exports = FollowCheck;
