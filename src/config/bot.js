const TelegramBot = require("node-telegram-bot-api");
const ParticipantController = require("../controllers/participantController");
const ChannelController = require("../controllers/channelController");
const VoteController = require("../controllers/voteController");
const { handleMessage } = require("../handlers/messageHandler");
const { Keyboard } = require("../utils/keyboard");
const CallbackHandler = require("../handlers/callbackHandler"); // Import the callback handler
const { identifyUser } = require("../utils/idenfy");
require("dotenv").config();

class TelegramBotClient {
  constructor() {
    if (!process.env.BOT_TOKEN) {
      console.error("Bot token is missing from environment variables.");
      return;
    }

    // Initialize the bot with the token and polling
    this.bot = new TelegramBot(process.env.BOT_TOKEN, {
      polling: true,
      request: {
        debug: true, // Enable debug logging
        delay: 1000, // Add a 1-second delay between requests
      },
    });

    // Check if bot is initialized successfully
    if (!this.bot) {
      console.error("Failed to initialize bot.");
      return;
    }

    console.log(`Telegram bot initialized successfully. Token`);

    // Register command handlers
    this.registerCommands();

    // Register message handler for custom keyboard input
    this.registerMessageHandler();

    // Register callback handlers
    this.registerCallbacks();

    // Handle polling errors
    this.pollingError();
  }

  registerCommands() {
    // Handle the /start command to display the custom keyboard
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const { isAdmin } = identifyUser(msg);
      const options = Keyboard(isAdmin);

      // Send a message with the custom keyboard
      this.bot
        .sendMessage(chatId, "Quyidagi buyruqlardan birini tanlang", options)
        .then(() => console.log("Custom keyboard sent successfully."))
        .catch((err) => console.error("Error sending custom keyboard:", err));
    });

    // Handle the /chetlatish command
    this.bot.onText(/\/chetlatish/, (msg) => {
      const { isAdmin } = identifyUser(msg);

      // Only allow admins to use this command
      if (isAdmin) {
        ParticipantController.handleDeleteParticipantCommand(msg, this.bot);
      } else {
        this.bot.sendMessage(
          msg.chat.id,
          "Sizda ushbu buyruqni bajarish uchun ruxsat yo'q."
        );
      }
    });

    this.bot.onText(/supur/, (msg) => {
      const { isAdmin } = identifyUser(msg);

      if (isAdmin) {
        const options = {
          reply_markup: {
            keyboard: [["Ha, barchasini o'chirish"], ["Bekor qilish"]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        };
        this.bot.sendMessage(
          msg.chat.id,
          "Haqiqatan ham barchasini o'chirmoqchimisiz?",
          options
        );
      } else {
        this.bot.sendMessage(
          msg.chat.id,
          "Sizda ushbu buyruqni bajarish uchun ruxsat yo'q."
        );
      }
    });

    // Handle the confirmation for "barchasini o'chirish"
    this.bot.on("message", (msg) => {
      if (msg.text === "Ha, barchasini o'chirish") {
        const { isAdmin } = identifyUser(msg);

        if (isAdmin) {
          ChannelController.handleDeleteAllChannelsCommand(msg, this.bot);
          VoteController.handleDeleteAllVotesCommand(msg, this.bot);
        } else {
          this.bot.sendMessage(
            msg.chat.id,
            "Sizda ushbu buyruqni bajarish uchun ruxsat yo'q."
          );
        }
      } else if (msg.text === "Bekor qilish") {
        this.bot.sendMessage(msg.chat.id, "Bekor qilindi.");
      }
    });
  }

  registerMessageHandler() {
    this.bot.on("message", (msg) => {
      handleMessage(msg, this.bot); // Pass the bot instance to handleMessage
    });
  }
  registerCallbacks() {
    console.log("Registering callback handler..."); // Debugging log

    // Handle all callback queries
    this.bot.on("callback_query", (callbackQuery) => {
      console.log("Callback query received:", callbackQuery); // Debugging log
      CallbackHandler.handleCallback(callbackQuery, this.bot); // Use the handleCallback method
    });
  }

  pollingError() {
    this.bot.on("polling_error", (err) => {
      console.error("Polling error:", err);
    });
  }
}

// Create a singleton instance of the TelegramBotClient class
const telegramBot = new TelegramBotClient();

// Export the bot instance
module.exports = {
  telegramBot,
  bot: telegramBot.bot, // Export the bot instance directly
};
