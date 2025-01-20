const botController = require("../controllers/botController");
const VoteController = require("../controllers/voteController");
const { identifyUser } = require("../utils/idenfy");
const ParticipantController = require("../controllers/participantController");
const s3Client = require("../config/s3"); // Import S3 client
const {
  getUserState,
  setUserState,
  clearUserState,
} = require("../utils/stateManager");
const ChannelController = require("../controllers/channelController");

async function handleMessage(msg, bot) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userState = getUserState(userId); // Retrieve user state once
  let text = "";

  if (msg.text) {
    text = msg.text.toLowerCase();
    console.log("Text message:", text);
  } else if (msg.photo) {
    console.log("Photo message:", msg.photo);

    // Handle photo uploads when awaiting an image
    if (userState && userState.step === "awaiting_image") {
      await handlePhotoUpload(msg, bot, userState);
    } else {
      bot.sendMessage(
        chatId,
        "Iltimos, avval qatnashuvchi ma'lumotlarini kiriting."
      );
    }
    return;
  } else {
    console.log("Unhandled message type:", msg);
    bot.sendMessage(chatId, "Bu turdagi xabarni tushunmayman. ⚠️");
    return;
  }

  // Identify the user
  const { isAdmin } = identifyUser(msg);

  // Handle conversation steps based on user state
  if (userState) {
    switch (userState.step) {
      case "awaiting_full_name":
      case "awaiting_school_grade":
      case "awaiting_description":
      case "awaiting_image":
      case "awaiting_video_url":
        await ParticipantController.handleCreateParticipant(msg, bot);
        return;
      case "askUsername":
      case "askName":
        await ChannelController.addChannel(msg, bot);
        return;
      default:
        console.log("Unhandled user state:", userState.step);
        break;
    }
  }

  // Handle commands with a switch-case block
  switch (text) {
    case "/start":
      await botController.handleStart(msg, bot);
      break;

    case "yordam":
      await botController.handleHelp(msg, bot);
      break;

    case "ovoz berish":
      console.log("Received 'ovoz berish' command.");
      await VoteController.handleVoteOrRevokeCommand(
        "vote",
        userId,
        null,
        bot,
        chatId
      );
      break;

    case "qaytarish":
      await VoteController.handleVoteOrRevokeCommand(
        "revoke",
        userId,
        null,
        bot,
        chatId
      );
      break;

    case "reyting":
      await VoteController.handleLeaderboard(msg, bot);
      break;

    case "barcha qatnashuvchilar":
      await ParticipantController.handleAllParticipants(msg, bot);
      break;

    case "kanal qo'shish":
      if (isAdmin) {
        await ChannelController.addChannel(msg, bot);
      } else {
        bot.sendMessage(
          chatId,
          "Sizda ushbu buyruqni bajarish huquqi yo'q. ⚠️"
        );
      }
      break;

    case "kiritish":
      if (isAdmin) {
        await ParticipantController.startCreateParticipant(msg, bot);
      } else {
        bot.sendMessage(
          chatId,
          "Sizda ushbu buyruqni bajarish huquqi yo'q. ⚠️"
        );
      }
      break;

    case "chetlatish":
      if (isAdmin) {
        await ParticipantController.handleDeleteParticipantCommand(msg, bot);
      } else {
        bot.sendMessage(
          chatId,
          "Sizda ushbu buyruqni bajarish huquqi yo'q. ⚠️"
        );
      }
      break;

    case "post":
      if (isAdmin) {
        await ParticipantController.PostParticipants(msg, bot);
      } else {
        bot.sendMessage(
          chatId,
          "Sizda ushbu buyruqni bajarish huquqi yo'q. ⚠️"
        );
      }
      break;

    default:
      console.log(`Unhandled command received: ${text}`);
      bot.sendMessage(chatId, "Bunday buyruq mavjud emas. ⚠️");
      break;
  }
}

// Helper function to handle photo upload
async function handlePhotoUpload(msg, bot, userState) {
  const chatId = msg.chat.id;
  const photo = msg.photo[msg.photo.length - 1]; // Get the highest resolution photo
  const fileId = photo.file_id;

  try {
    console.log("Downloading photo from Telegram...");
    const fileStream = await bot.getFileStream(fileId);
    const chunks = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    const imageBuffer = Buffer.concat(chunks);
    console.log("Photo downloaded successfully.");

    // Upload the image to S3
    console.log("Uploading photo to S3...");
    const imageUrl = await s3Client.uploadFile(
      imageBuffer,
      `participants/${Date.now()}_${userState.fullName}.jpg`,
      "image/jpeg"
    );
    console.log("Photo uploaded to S3:", imageUrl);

    // Update user state and prompt for the next step
    userState.imageUrl = imageUrl;
    userState.step = "awaiting_video_url";
    setUserState(msg.from.id, userState);
    await bot.sendMessage(chatId, "Video URL manzilini kiriting:");
  } catch (err) {
    console.error("Error uploading image to S3:", err);
    await bot.sendMessage(
      chatId,
      "Rasm yuklashda xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
    );
  }
}

module.exports = {
  handleMessage,
};
