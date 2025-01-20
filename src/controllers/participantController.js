const Participant = require("../models/Participant");
const {
  setUserState,
  getUserState,
  clearUserState,
} = require("../utils/stateManager");
const s3Client = require("../config/s3");
const Channel = require("../models/Channels");
const {
  InlineKeyboard,
  createParticipantButtons,
} = require("../utils/keyboard");

class ParticipantController {
  // - user state management
  static async startCreateParticipant(msg, bot) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Set the user's state to "awaiting_full_name"
    setUserState(userId, { step: "awaiting_full_name" });

    // Ask the user for the participant's full name
    await bot.sendMessage(chatId, "Qatnashuvchi ismini kiriting:");
  }

  static async handleCreateParticipant(msg, bot) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // Get the user's current state
    const userState = getUserState(userId);

    if (!userState) {
      await bot.sendMessage(
        chatId,
        "Iltimos, /kiritish buyrug'ini qayta kiriting."
      );
      return;
    }

    switch (userState.step) {
      case "awaiting_full_name":
        // Save the full name and ask for the school grade
        userState.fullName = text;
        userState.step = "awaiting_school_grade";
        await bot.sendMessage(chatId, "Qatnashuvchi sinfini kiriting:");
        break;

      case "awaiting_school_grade":
        // Save the school grade and ask for the description
        userState.schoolGrade = text;
        userState.step = "awaiting_description";
        await bot.sendMessage(
          chatId,
          "Qatnashuvchi haqida qisqacha ma'lumot kiriting:"
        );
        break;

      case "awaiting_description":
        // Save the description and ask for the image
        userState.description = text;
        userState.step = "awaiting_image";
        await bot.sendMessage(chatId, "Rasm yuboring:");
        break;

      case "awaiting_image":
        if (!msg.photo) {
          await bot.sendMessage(chatId, "Iltimos, rasm yuboring.");
          return;
        }

        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;

        try {
          console.log("Fetching photo from Telegram...");
          const fileLink = await bot.getFileLink(fileId); // Fetch file URL
          const response = await fetch(fileLink); // Download image
          const imageBuffer = Buffer.from(await response.arrayBuffer());

          console.log("Uploading to S3...");
          const imageUrl = await s3Client.uploadFile(
            imageBuffer,
            `participants/${Date.now()}_${userState.fullName}.jpg`,
            "image/jpeg",
            { ACL: "public-read" } // - public read access
          );

          console.log("Uploaded successfully:", imageUrl);
          userState.imageUrl = imageUrl;
          userState.step = "awaiting_video_url";
          await bot.sendMessage(chatId, "Video URL manzilini kiriting:");
        } catch (err) {
          console.error("Image processing failed:", err);
          await bot.sendMessage(chatId, "Rasm yuklashda xatolik yuz berdi.");
        }
        break;

      case "awaiting_video_url":
        // Save the video URL and create the participant
        userState.videoLink = text;

        try {
          // Create the participant
          const newParticipant = await Participant.create(
            userState.fullName,
            userState.schoolGrade,
            userState.description,
            userState.imageUrl,
            userState.videoLink
          );

          // Send confirmation message
          await bot.sendMessage(
            chatId,
            `Yangi qatnashuvchi muvaffaqiyatli qo'shildi:\n\n` +
              `👤 Ism: ${newParticipant.full_name}\n` +
              `📄 Ma'lumot: ${newParticipant.description}\n` +
              `🏫 Sinf: ${newParticipant.school_grade}\n` +
              `🖼️ Rasm: ${newParticipant.image_url}\n` +
              `📹 Video: ${newParticipant.video_link}`
          );
        } catch (err) {
          console.error("Error creating participant:", err);
          await bot.sendMessage(
            chatId,
            "Qatnashuvchi qo'shishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
          );
        } finally {
          // Clear the user's state
          clearUserState(userId);
        }
        break;

      default:
        await bot.sendMessage(
          chatId,
          "Xatolik yuz berdi. Iltimos, /kiritish buyrug'ini qayta kiriting."
        );
        clearUserState(userId);
        break;
    }
  }

  // ! Remove a participant by ID

  static async handleDeleteParticipantCommand(msg, bot) {
    const chatId = msg.chat.id;

    try {
      // Fetch all participants
      const participants = await Participant.findAll();

      if (!participants.length) {
        await bot.sendMessage(
          chatId,
          "Hozircha hech qanday qatnashuvchi yo'q."
        );
        return;
      }

      // Create inline buttons for participants
      const inlineKeyboard = {
        reply_markup: {
          inline_keyboard: participants.map((participant) => [
            {
              text: participant.full_name,
              callback_data: `delete_${participant.id}`,
            },
          ]),
        },
      };

      // Send the list of participants with inline buttons
      await bot.sendMessage(
        chatId,
        "Qaysi qatnashuvchini o'chirmoqchisiz? Quyidagilardan birini tanlang:",
        inlineKeyboard
      );
    } catch (err) {
      console.error("Error fetching participants:", err);
      await bot.sendMessage(
        chatId,
        "Qatnashuvchilarni yuklashda xatolik yuz berdi."
      );
    }
  }

  // - delete participant callback
  static async handleDeleteParticipantCallback(callbackQuery, bot) {
    const chatId = callbackQuery.message.chat.id;
    const participantId = callbackQuery.data.split("_")[1]; // Extract participant ID

    console.log("Participant ID to delete:", participantId); // Debugging log

    try {
      // Fetch the participant's data before deleting
      const participant = await Participant.findById(participantId);

      if (!participant) {
        console.log("Participant not found in the database.");
        await bot.sendMessage(chatId, "Qatnashuvchi topilmadi.");
        return;
      }

      console.log("Participant found:", participant);

      // Delete the image from S3 if it exists
      if (participant.image_url) {
        const imageUrl = participant.image_url;
        console.log("Image URL from database:", imageUrl);

        const fileName = imageUrl.split("/").pop(); // Extract the file name from the URL
        console.log("Extracted file name from URL:", fileName);

        console.log("Attempting to delete image from S3...");
        await s3Client.deleteFile(`participants/${fileName}`); // Delete the file from S3
        console.log("Image deleted from S3 successfully.");
      } else {
        console.log("No image URL found for participant.");
      }

      // Delete the participant from the database
      console.log("Attempting to delete participant from the database...");
      const result = await Participant.delete(participantId);

      if (result.rowCount === 0) {
        console.log("Participant not found in the database.");
        await bot.sendMessage(chatId, "Qatnashuvchi topilmadi.");
      } else {
        console.log("Participant deleted from the database successfully.");
        await bot.sendMessage(
          chatId,
          "Qatnashuvchi muvaffaqiyatli o'chirildi."
        );
      }
    } catch (err) {
      console.error("Error deleting participant:", err);
      await bot.sendMessage(
        chatId,
        "Qatnashuvchini o'chirishda xatolik yuz berdi."
      );
    }
  }

  // : barcha qatnashuvchilarni ko'rish

  static async handleAllParticipants(msg, bot) {
    const chatId = msg.chat.id;

    try {
      const participants = await Participant.findAll();
      if (!participants.length) {
        await bot.sendMessage(
          chatId,
          "Hozircha hech qanday qatnashuvchi yo'q."
        );
        return;
      }

      for (const participant of participants) {
        const participantDetails = `
📌 *Qatnashuvchi ma'lumotlari:*

👤 Ism: ${participant.full_name}
🎓 Sinf: ${participant.school_grade || "Noma'lum"}
📝 Tavsif: ${participant.description || "Noma'lum"}
      `;

        const inlineKeyboard = InlineKeyboard(participant);

        if (participant.image_url) {
          console.log("Image URL:", participant.image_url); // Debugging log
          try {
            await bot.sendPhoto(chatId, participant.image_url, {
              caption: participantDetails,
              parse_mode: "Markdown",
              reply_markup: inlineKeyboard.reply_markup,
            });
            console.log("Sent photo with inline buttons"); // Debugging log
          } catch (err) {
            console.error("Error sending photo:", err);
            await bot.sendMessage(chatId, participantDetails, {
              parse_mode: "Markdown",
              reply_markup: inlineKeyboard.reply_markup,
            });
          }
        } else {
          await bot.sendMessage(chatId, participantDetails, {
            parse_mode: "Markdown",
            reply_markup: inlineKeyboard.reply_markup,
          });
        }
      }
    } catch (err) {
      console.error("Error fetching participants:", err);
      await bot.sendMessage(
        chatId,
        "Qatnashuvchilarni yuklashda xatolik yuz berdi."
      );
    }
  }

  // - post all participants to the channel

  static async PostParticipants(msg, bot) {
    try {
      // Fetch the required channel from the database
      const requiredChannel = await Channel.findRequiredChannel();
      if (!requiredChannel) {
        await bot.sendMessage(
          msg.chat.id,
          "Kanal topilmadi. Iltimos, administrator bilan bog'laning."
        );
        return;
      }

      const channelId = requiredChannel.channel_id; // Use the dynamically fetched channel ID

      const participants = await Participant.findAll();
      if (!participants.length) {
        await bot.sendMessage(
          channelId,
          "Hozircha hech qanday qatnashuvchi yo'q."
        );
        return;
      }

      for (const participant of participants) {
        const participantDetails = `
📌 *Qatnashuvchi ma'lumotlari:*

👤 Ism: ${participant.full_name}
🎓 Sinf: ${participant.school_grade || "Noma'lum"}
📝 Tavsif: ${participant.description || "Noma'lum"}
            `;

        const inlineKeyboard = InlineKeyboard(participant);

        if (participant.image_url) {
          console.log("Image URL:", participant.image_url); // Debugging log
          try {
            await bot.sendPhoto(channelId, participant.image_url, {
              caption: participantDetails,
              parse_mode: "Markdown",
              reply_markup: inlineKeyboard.reply_markup,
            });
            console.log("Sent photo with inline buttons"); // Debugging log
          } catch (err) {
            console.error("Error sending photo:", err);
            await bot.sendMessage(channelId, participantDetails, {
              parse_mode: "Markdown",
              reply_markup: inlineKeyboard.reply_markup,
            });
          }
        } else {
          await bot.sendMessage(channelId, participantDetails, {
            parse_mode: "Markdown",
            reply_markup: inlineKeyboard.reply_markup,
          });
        }
      }
    } catch (err) {
      console.error("Error fetching participants:", err);
      await bot.sendMessage(
        msg.chat.id,
        "Qatnashuvchilarni yuklashda xatolik yuz berdi."
      );
    }
  }
}

module.exports = ParticipantController;
