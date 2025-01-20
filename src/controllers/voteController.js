const Vote = require("../models/Votes");
const Participant = require("../models/Participant");
const Channel = require("../models/Channels");
const followCheck = require("../utils/followChek");

class VoteController {
  /**
   * Handles the initial command to vote or revoke a vote.
   * Sends a list of participants for the user to choose from.
   * @param {string} action - The action to perform ("vote" or "revoke").
   * @param {object} msg - The message object from Telegram.
   * @param {object} bot - The Telegram bot instance.
   */
  static async handleVoteOrRevokeCommand(
    action,
    userId,
    participantId,
    bot,
    chatId
  ) {
    try {
      // Check if the user follows the required channel
      const isFollowing = await followCheck.isFollowingChannel(bot, userId);
      if (!isFollowing) {
        await bot.sendMessage(
          chatId,
          "Iltimos, ovoz berish uchun quyidagi kanalga a'zo bo'ling: [Kanal Nomi](https://t.me/your_channel)"
        );
        return;
      }

      // Fetch all participants
      const participants = await Participant.findAll();

      if (!participants.length) {
        await bot.sendMessage(
          chatId,
          "Hozircha hech qanday qatnashuvchi topilmadi."
        );
        return;
      }

      // Create inline buttons for participants
      const inlineKeyboard = participants.map((participant) => [
        {
          text: participant.full_name,
          callback_data: `${action}_${participant.id}`,
        },
      ]);

      // Send the list of participants with inline buttons
      await bot.sendMessage(
        chatId,
        "Quyidagi qatnashuvchilardan birini tanlang:",
        {
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        }
      );
    } catch (err) {
      console.error("Error fetching participants:", err);
      await bot.sendMessage(
        chatId,
        "Qatnashuvchilarni yuklashda xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
      );
    }
  }

  /**
   * Handles the callback when a user selects a participant to vote or revoke.
   * @param {string} action - The action to perform ("vote" or "revoke").
   * @param {string} userId - ID of the user performing the action.
   * @param {string} participantId - ID of the participant.
   * @param {object} bot - Telegram bot instance.
   * @param {string} chatId - ID of the chat where the action is performed.
   */

  // - async handleVoteOrRevokeCallback(action, userId, participantId, bot, chatId, callbackQuery)

  static async handleVoteOrRevokeCallback(
    action,
    userId,
    participantId,
    bot,
    chatId,
    callbackQuery
  ) {
    console.log("Handling vote/revoke callback:", {
      action,
      userId,
      participantId,
    });

    try {
      // Fetch the required channel from the database
      const requiredChannel = await Channel.findRequiredChannel();
      if (!requiredChannel) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Kanal topilmadi. Iltimos, administrator bilan bog'laning.",
          show_alert: true, // Show as a pop-up alert
        });
        return;
      }

      const { channel_id: channelId, channel_name: channelName } =
        requiredChannel;
      const channelLink = `https://t.me/${channelId.replace("@", "")}`; // Generate the channel link

      // Fetch the participant's details
      const participant = await Participant.findById(participantId);
      if (!participant) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Qatnashuvchi topilmadi. ❌",
          show_alert: true, // Show as a pop-up alert
        });
        return;
      }

      const participantName = participant.full_name;

      // Check if the user follows the required channel
      const isFollowing = await followCheck.isFollowingChannel(
        bot,
        userId,
        channelId
      );
      if (!isFollowing) {
        // Send a private message with the channel link and inline button
        try {
          await bot.sendMessage(
            userId, // Send to the user's private chat
            `Iltimos, ovoz berish uchun quyidagi kanalga a'zo bo'ling: ${channelName}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Kanalga a'zo bo'lish",
                      url: channelLink, // Use the dynamically generated channel link
                    },
                  ],
                ],
              },
            }
          );

          // Acknowledge the callback query
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: `Siz ${channelName} kanaliga a'zo bo'lishingiz kerak. Xabaringizga qarang.`,
            show_alert: true, // Show as a pop-up alert
          });
        } catch (err) {
          console.error("Error sending private message:", err);

          // Fallback: If the bot cannot send a private message, show an alert with the link
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: `Iltimos, ovoz berish uchun quyidagi kanalga a'zo bo'ling: ${channelName} - ${channelLink}`,
            show_alert: true, // Show as a pop-up alert
          });
        }
        return;
      }

      if (action === "vote") {
        // Check if the user has already voted for this specific participant
        const hasVotedForParticipant = await Vote.hasUserVotedForParticipant(
          userId,
          participantId
        );
        if (hasVotedForParticipant) {
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: `Siz ${participantName} uchun ovoz berib bo'lgansiz. ❗`,
            show_alert: true, // Show as a pop-up alert
          });
          return;
        }

        // Check if the user has voted for any other participant
        const hasVotedForAny = await Vote.hasUserVoted(userId);
        if (hasVotedForAny) {
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: `Siz boshqa qatnashuvchi uchun ovoz berib bo'lgansiz. ❗`,
            show_alert: true, // Show as a pop-up alert
          });
          return;
        }

        // Add the vote to the database
        await Vote.create(userId, participantId);

        // Increment the participant's vote count
        await Participant.incrementVoteCount(participantId);

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `Siz ${participantName} uchun ovoz berdingiz. ✅`,
          show_alert: true, // Show as a pop-up alert
        });
      } else if (action === "revoke") {
        // Check if the user has voted for this participant
        const existingVote = await Vote.findByUserAndParticipant(
          userId,
          participantId
        );
        if (!existingVote) {
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: `Siz ${participantName} uchun ovoz bermagansiz. ❗`,
            show_alert: true, // Show as a pop-up alert
          });
          return;
        }

        // Remove the vote from the database
        await Vote.delete(existingVote.id);

        // Decrement the participant's vote count
        await Participant.decrementVoteCount(participantId);

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `Siz ${participantName} uchun ovozingizni bekor qildingiz.🔄`,
          show_alert: true, // Show as a pop-up alert
        });
      }
    } catch (err) {
      console.error("Error handling vote/revoke:", err);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
        show_alert: true, // Show as a pop-up alert
      });
    }
  }

  /**
   * Displays the leaderboard of participants sorted by vote count.
   * @param {object} msg - The message object from Telegram.
   * @param {object} bot - The Telegram bot instance.
   */
  static async handleLeaderboard(msg, bot) {
    const chatId = msg.chat.id;

    try {
      // Fetch all participants sorted by vote count
      const participants = await Participant.findAllSortedByVotes();

      if (!participants.length) {
        await bot.sendMessage(
          chatId,
          "Hozircha hech qanday qatnashuvchi topilmadi."
        );
        return;
      }

      // Format the leaderboard message
      const leaderboard = participants
        .map(
          (participant, index) =>
            `${index + 1}. ${participant.full_name} - ${
              participant.vote_count
            } ovoz`
        )
        .join("\n");

      await bot.sendMessage(chatId, `🏆 Leaderboard:\n\n${leaderboard}`);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      await bot.sendMessage(
        chatId,
        "Leaderboardni yuklashda xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
      );
    }
  }

  // -Delete all votes
  static async handleDeleteAllVotesCommand(msg, bot) {
    try {
      await Vote.deleteAll();
      await bot.sendMessage(msg.chat.id, "Barcha ovozlar o'chirildi. ✅");
    } catch (err) {
      console.error("Error deleting all votes:", err);
      await bot.sendMessage(
        msg.chat.id,
        "Ovozlarni o'chirishda xatolik yuz berdi. ❌"
      );
    }
  }
}

module.exports = VoteController;
