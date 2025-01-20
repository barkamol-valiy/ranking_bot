const Channel = require("../models/Channels");
const {
  setUserState,
  getUserState,
  clearUserState,
} = require("../utils/stateManager");

class ChannelController {
  constructor() {
    this.channel = Channel;
  }

  // - Add a new channel

  static async addChannel(msg, bot) {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Get the current state of the user
    const userState = getUserState(chatId);

    if (!userState) {
      // Initialize user state
      setUserState(chatId, { step: "askUsername" });

      await bot.sendMessage(chatId, "Iltimos, kanal username kiriting:");
      return;
    }

    if (userState.step === "askUsername") {
      // Save the username and move to the next step
      setUserState(chatId, {
        ...userState,
        channelUsername: text,
        step: "askName",
      });

      await bot.sendMessage(chatId, "Iltimos, kanal nomini kiriting:");
      return;
    }

    if (userState.step === "askName") {
      // Save the channel name and add the channel to the database
      const channelName = text;

      try {
        // Validate input
        if (!userState.channelUsername || !channelName) {
          throw new Error("Kanal username yoki nomi kiritilmadi.");
        }

        // Add the channel to the database
        const newChannel = await Channel.create(
          userState.channelUsername,
          channelName
        );

        // Send confirmation message
        await bot.sendMessage(
          chatId,
          `Yangi kanal muvaffaqiyatli qo'shildi:\n\n` +
            `🆔 Kanal ID: ${newChannel.channel_id}\n` +
            `📛 Kanal nomi: ${newChannel.channel_name}`
        );

        // Clear the user state
        clearUserState(chatId);
      } catch (err) {
        console.error("Error adding channel:", err);
        await bot.sendMessage(
          chatId,
          "Kanal qo'shishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
        );

        // Clear the user state in case of error
        clearUserState(chatId);
      }
    }
  }

  // / Fetch the required channel to follow
  static async getRequiredChannel(msg, bot) {
    const chatId = msg.chat.id;

    try {
      // Fetch the required channel
      const requiredChannel = await Channel.findRequiredChannel();

      if (!requiredChannel) {
        await bot.sendMessage(chatId, "Hozircha hech qanday kanal topilmadi.");
        return;
      }

      // Send the required channel details
      await bot.sendMessage(
        chatId,
        `Quyidagi kanalga obuna bo'lishingiz kerak:\n\n` +
          `🆔 Kanal ID: ${requiredChannel.channel_id}\n` +
          `📛 Kanal nomi: ${requiredChannel.channel_name}`
      );
    } catch (err) {
      console.error("Error fetching required channel:", err);
      await bot.sendMessage(
        chatId,
        "Kanalni yuklashda xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
      );
    }
  }

  // Fetch all channels
  static async getAllChannels(msg, bot) {
    const chatId = msg.chat.id;

    try {
      // Fetch all channels
      const channels = await Channel.findAll();

      if (!channels.length) {
        await bot.sendMessage(chatId, "Hozircha hech qanday kanal topilmadi.");
        return;
      }

      // Send the list of channels
      const channelList = channels
        .map(
          (channel) =>
            `🆔 Kanal ID: ${channel.channel_id}\n📛 Kanal nomi: ${channel.channel_name}\n`
        )
        .join("\n");

      await bot.sendMessage(
        chatId,
        `Barcha kanallar ro'yxati:\n\n${channelList}`
      );
    } catch (err) {
      console.error("Error fetching channels:", err);
      await bot.sendMessage(
        chatId,
        "Kanallarni yuklashda xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
      );
    }
  }

  // !Delete all channels
  static async handleDeleteAllChannelsCommand(msg, bot) {
    try {
      await Channel.deleteAll();
      await bot.sendMessage(msg.chat.id, "Barcha kanallar o'chirildi. ✅");
    } catch (err) {
      console.error("Error deleting all channels:", err);
      await bot.sendMessage(
        msg.chat.id,
        "Kanalni o'chirishda xatolik yuz berdi. ❌"
      );
    }
  }
}

module.exports = ChannelController;
