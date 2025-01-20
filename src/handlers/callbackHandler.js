const ParticipantController = require("../controllers/participantController");
const VoteController = require("../controllers/voteController");

module.exports = {
  /**
   * Handles all callback queries.
   * @param {object} callbackQuery - The callback query object from Telegram.
   * @param {object} bot - The Telegram bot instance.
   */
  async handleCallback(callbackQuery, bot) {
    console.log("Callback received:", callbackQuery); // Debugging log

    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    console.log("Callback data:", data); // Debugging log

    // Extract the action and ID from the callback data
    const [action, id] = data.split("_");

    console.log("Action:", action); // Debugging log
    console.log("Participant ID:", id); // Debugging log

    try {
      switch (action) {
        case "delete":
          console.log("Handling delete action..."); // Debugging log
          await ParticipantController.handleDeleteParticipantCallback(
            callbackQuery,
            bot
          );
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "Ishtirokchi muvaffaqiyatli o'chirildi.",
            show_alert: true, // Pop-up alert
          });
          break;

        case "vote":
          console.log("Handling vote action..."); // Debugging log
          await VoteController.handleVoteOrRevokeCallback(
            "vote",
            userId,
            id,
            bot,
            chatId,
            callbackQuery
          );
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "Sizning ovozingiz qabul qilindi.",
            show_alert: true, // Inline message
          });
          break;

        case "revoke":
          console.log("Handling revoke action..."); // Debugging log
          await VoteController.handleVoteOrRevokeCallback(
            "revoke",
            userId,
            id,
            bot,
            chatId,
            callbackQuery
          );
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "Ovoz qaytarib olindi.",
            show_alert: true, // Inline message
          });
          break;

        default:
          console.warn("Unknown action received:", action);
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "Noma'lum amal. Iltimos, qayta urinib ko'ring.",
            show_alert: true, // Pop-up alert for unexpected action
          });
          break;
      }
    } catch (err) {
      console.error("Error handling callback:", err);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
        show_alert: true, // Pop-up alert for errors
      });
    }
  },
};
