require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
// Initialize Telegram Bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

process.env["NTBA_FIX_350"] = 1;
// Initialize PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USERNAME,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function handleError(chatId, error, customMessage) {
  console.error("Error:", error);
  await bot.sendMessage(chatId, customMessage);
}

// Global error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "Reason:", reason);
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("Shutting down gracefully...");
  pool.end(() => {
    console.log("Database connection closed.");
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Store user states for multi-step input
const userStates = {};

const adminCommands = [
  {
    command: "➕ Yangi ishtirokchi",
    description: "Yangi ishtirokchi qo'shish",
  },
  {
    command: "❌ Ishtirokchini chetlatish",
    description: "Ishtirokchini chetlashtirish",
  },
  {
    command: "📢 Kanal qo'shish",
    description: "Talab qilingan kanal qo'shish",
  },
  { command: "🏆 Reyting", description: "O'rinlarni ko'rish" },
  {
    command: "👥 Ishtirokchilar",
    description: "Barcha ishtirokchilarni ko'rish",
  },
  { command: "🗳️ Ovoz berish", description: "Ishtirokchiga ovoz berish" },
  {
    command: "✅ Obunani tekshirish",
    description: "Kanalga obuna holatini tekshirish",
  },
];

const userCommands = [
  {
    command: "👥 Ishtirokchilar",
    description: "Barcha ishtirokchilarni ko'rish",
  },
  { command: "🏆 Reyting", description: "O'rinlarni ko'rish" },
  { command: "🗳️ Ovoz berish", description: "Ishtirokchiga ovoz berish" },
  {
    command: "✅ Obunani tekshirish",
    description: "Kanalga obuna holatini tekshirish",
  },
];

// Helper: Check if user is admin
async function checkAdmin(chatId) {
  const adminIds = process.env.ADMIN_IDS.split(",").map(Number);
  return adminIds.includes(chatId);
}

// Helper: Check if user is subscribed to the required channel
async function checkFollowStatus(userId) {
  try {
    const result = await pool.query("SELECT channel_id FROM channels LIMIT 1");
    if (result.rows.length === 0) {
      console.error("Bazada hech qanday kanal topilmadi.");
      return false;
    }

    const channelId = result.rows[0].channel_id;
    const chatMember = await bot.getChatMember(channelId, userId);
    return ["member", "administrator", "creator"].includes(chatMember.status);
  } catch (error) {
    console.error("Kanalga obuna holatini tekshirishda xato:", error.message);
    return false;
  }
}

// Helper: Get channel info from the database
async function getChannelInfo() {
  try {
    const result = await pool.query(
      "SELECT channel_id, channel_name FROM channels LIMIT 1"
    );
    if (result.rows.length === 0) return null;
    return {
      channelId: result.rows[0].channel_id,
      channelName: result.rows[0].channel_name,
    };
  } catch (error) {
    console.error("Kanal ma'lumotlarini olishda xato:", error);
    return null;
  }
}

// Helper: Send subscription message with inline keyboard
async function sendChannelSubscriptionMessage(chatId, action, participantId) {
  const channelInfo = await getChannelInfo();
  if (!channelInfo) {
    return bot.sendMessage(
      chatId,
      "Iltimos, admin kanal qo'shishini kutib turing."
    );
  }

  const { channelId, channelName } = channelInfo;

  const subscriptionKeyboard = {
    inline_keyboard: [
      [
        {
          text: `Obuna bo'lish: ${channelName}`,
          url: `https://t.me/${channelId.replace("@", "")}`,
        },
      ],
      [
        {
          text: "Obuna bo'ldim ✅",
          callback_data: `check_${action}_${participantId}`,
        },
      ],
    ],
  };

  await bot.sendMessage(
    chatId,
    `Ovoz berish uchun quyidagi kanalga obuna bo'lishingiz kerak: ${channelName}. Obuna bo'ling va "Obuna bo'ldim" tugmasini bosing.`,
    { reply_markup: subscriptionKeyboard }
  );
}

// Helper: Handle voting or revoking votes
async function handleVoteOrRevoke(
  chatId,
  userId,
  action,
  participantId,
  callbackQueryId
) {
  try {
    if (action === "vote") {
      // Check if the user has already voted for ANY participant
      const hasVoted = await pool.query(
        "SELECT participants.name, participants.surname FROM votes " +
          "JOIN participants ON votes.participant_id = participants.id " +
          "WHERE votes.user_id = $1",
        [userId]
      );

      if (hasVoted.rows.length > 0) {
        const participantName = `${hasVoted.rows[0].name} ${hasVoted.rows[0].surname}`;
        return bot.answerCallbackQuery(callbackQueryId, {
          text: `Siz allaqachon ${participantName} ga ovoz berib bo'lgansiz! Faqat bitta ishtirokchiga ovoz berishingiz mumkin.`,
          show_alert: true,
        });
      }

      // Insert the vote into the database
      await pool.query(
        "INSERT INTO votes (participant_id, user_id) VALUES ($1, $2)",
        [participantId, userId]
      );

      // Notify the user that their vote was successful
      bot.answerCallbackQuery(callbackQueryId, {
        text: "Ovozingiz muvaffaqiyatli qabul qilindi!",
        show_alert: true,
      });

      // Get the participant's name
      const participant = await pool.query(
        "SELECT name, surname FROM participants WHERE id = $1",
        [participantId]
      );
      const participantName = `${participant.rows[0].name} ${participant.rows[0].surname}`;

      // Send a message to the user confirming their vote
      bot.sendMessage(
        chatId,
        `Siz ${participantName} ga ovoz berdingiz. Rahmat!`
      );
    } else if (action === "revoke") {
      // Handle revoking a vote
      const hasVoted = await pool.query(
        "SELECT * FROM votes WHERE user_id = $1 AND participant_id = $2",
        [userId, participantId]
      );
      if (hasVoted.rows.length === 0) {
        return bot.answerCallbackQuery(callbackQueryId, {
          text: "Siz ushbu ishtirokchiga ovoz bermagansiz!",
          show_alert: true,
        });
      }

      // Delete the vote from the database
      await pool.query(
        "DELETE FROM votes WHERE user_id = $1 AND participant_id = $2",
        [userId, participantId]
      );

      // Notify the user that their vote was revoked
      bot.answerCallbackQuery(callbackQueryId, {
        text: "Ovozingiz muvaffaqiyatli qaytarib olindi! Endi boshqa ishtirokchiga ovoz berishingiz mumkin.",
        show_alert: true,
      });

      // Get the participant's name
      const participant = await pool.query(
        "SELECT name, surname FROM participants WHERE id = $1",
        [participantId]
      );
      const participantName = `${participant.rows[0].name} ${participant.rows[0].surname}`;

      // Send a message to the user confirming their vote revocation
      bot.sendMessage(
        chatId,
        `Siz ${participantName} dan ovozingizni qaytarib oldingiz. Endi boshqa ishtirokchiga ovoz berishingiz mumkin.`
      );
    }
  } catch (error) {
    console.error("Xatolik yuz berdi:", error);
    bot.answerCallbackQuery(callbackQueryId, {
      text: "Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
      show_alert: true,
    });
  }
}

// Handle callback queries (e.g., voting, revoking, subscription check, kicking)
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data; // e.g., "kick_123", "check_vote_11", "vote_11"
  const [action, ...rest] = data.split("_"); // Split into action and the rest

  console.log(`Received callbackQuery with data: ${data}`);

  try {
    // Handle "kick" action
    if (action === "kick") {
      const participantId = rest[0];
      const isAdmin = await checkAdmin(chatId);
      if (!isAdmin) {
        return bot.answerCallbackQuery(callbackQuery.id, {
          text: "Sizda bu amalni bajarish huquqi yo'q.",
          show_alert: true,
        });
      }

      // Delete the participant from the database
      await pool.query("DELETE FROM participants WHERE id = $1", [
        participantId,
      ]);

      // Notify the user that the participant was kicked
      bot.answerCallbackQuery(callbackQuery.id, {
        text: "Ishtirokchi muvaffaqiyatli chetlashtirildi!",
        show_alert: true,
      });

      // Send a confirmation message to the chat
      bot.sendMessage(chatId, "Ishtirokchi muvaffaqiyatli chetlashtirildi!");
    }

    // Handle "check" action (e.g., "Obuna bo'ldim" button)
    if (action === "check") {
      const [originalAction, originalParticipantId] = rest;

      // Re-check if the user is now subscribed
      const hasFollowed = await checkFollowStatus(userId);
      if (!hasFollowed) {
        return bot.answerCallbackQuery(callbackQuery.id, {
          text: "Siz hali kanalga obuna bo'lmagansiz. Iltimos, avval obuna bo'ling.",
          show_alert: true,
        });
      }

      // Notify the user that they are subscribed
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "✅ Siz kanalga obuna bo'ldingiz!",
        show_alert: true,
      });

      // Proceed with the original action (e.g., voting or revoking)
      if (originalAction === "vote" || originalAction === "revoke") {
        await handleVoteOrRevoke(
          chatId,
          userId,
          originalAction,
          originalParticipantId,
          callbackQuery.id
        );
      } else {
        // If no specific action, show the list of participants
        await sendParticipantsList(chatId);
      }
    }

    // Handle voting or revoking votes
    if (action === "vote" || action === "revoke") {
      const hasFollowed = await checkFollowStatus(userId);
      if (!hasFollowed) {
        // If not subscribed, send a message with an inline button to join the channel
        await sendChannelSubscriptionMessage(chatId, action, rest[0]);
        return bot.answerCallbackQuery(callbackQuery.id, {
          text: "Iltimos, kanalga obuna bo'ling.",
          show_alert: true,
        });
      }

      // If the user is subscribed, proceed with the vote or revoke action
      await handleVoteOrRevoke(
        chatId,
        userId,
        action,
        rest[0], // participantId
        callbackQuery.id
      );
    }
  } catch (error) {
    console.error("Xatolik yuz berdi:", error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
      show_alert: true,
    });
  }
});

// Command: Start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || "";
  const lastName = msg.from.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();

  const isAdmin = await checkAdmin(chatId);

  // Welcome message with emojis and Markdown formatting
  const welcomeMessage = isAdmin
    ? `👋 *Salom, Admin ${fullName || "Foydalanuvchi"}!*\n\n` +
      `🎉 *Dream School* botiga xush kelibsiz!\n\n` +
      `Quyidagi buyruqlardan birini tanlang:\n\n` +
      adminCommands
        .map((cmd) => `👉 *${cmd.command}* - ${cmd.description}`)
        .join("\n")
    : `👋 *Salom, ${fullName || "Foydalanuvchi"}!*\n\n` +
      `🎉 *Dream School* botiga xush kelibsiz!\n\n` +
      `Quyidagi buyruqlardan birini tanlang:\n\n` +
      userCommands
        .map((cmd) => `👉 *${cmd.command}* - ${cmd.description}`)
        .join("\n");

  // Reply keyboard buttons with emojis and descriptions
  const replyMarkup = {
    keyboard: isAdmin
      ? adminCommands.map((cmd) => [
          { text: `${cmd.command} - ${cmd.description}` },
        ])
      : userCommands.map((cmd) => [
          { text: `${cmd.command} - ${cmd.description}` },
        ]),
    resize_keyboard: true,
    one_time_keyboard: true,
  };

  // Send the welcome message with Markdown formatting
  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: "Markdown",
    reply_markup: replyMarkup,
  });
});

// Command: Yangi ishtirokchi qo'shish (Admin uchun)
bot.onText(/➕ Yangi ishtirokchi /, async (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = await checkAdmin(chatId);
  if (!isAdmin) {
    return bot.sendMessage(chatId, "Sizda bu buyruqni bajarish huquqi yo'q.");
  }

  userStates[chatId] = { step: "awaiting_name" };
  bot.sendMessage(chatId, "Iltimos, ishtirokchi ismini kiriting:");
});

// Yangi ishtirokchi qo'shish uchun ko'p qadamli kirishni boshqarish
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!userStates[chatId]) return;

  const state = userStates[chatId];

  if (state.step === "awaiting_name") {
    state.name = text;
    state.step = "awaiting_surname";
    bot.sendMessage(chatId, "Iltimos, ishtirokchi familiyasini kiriting:");
  } else if (state.step === "awaiting_surname") {
    state.surname = text;
    state.step = "awaiting_grade";
    bot.sendMessage(chatId, "Iltimos, ishtirokchi sinfini kiriting:");
  } else if (state.step === "awaiting_grade") {
    state.grade = text;
    state.step = "awaiting_classwork_text";
    bot.sendMessage(chatId, "Iltimos, ishtirokchi vazifasini kiriting:");
  } else if (state.step === "awaiting_classwork_text") {
    state.classwork_text = text;
    state.step = "awaiting_image";
    bot.sendMessage(chatId, "Iltimos, ishtirokchi rasmini yuklang:");
  } else if (state.step === "awaiting_image") {
    if (msg.photo) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const filePath = await bot.getFile(fileId);
      const imageUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath.file_path}`;

      const response = await fetch(imageUrl);
      const buffer = await response.buffer();
      const fileName = `${Date.now()}.jpg`;
      const filePathLocal = path.join(__dirname, "uploads", fileName);

      fs.writeFileSync(filePathLocal, buffer);
      state.image_path = filePathLocal;
      state.step = "awaiting_video_url";
      bot.sendMessage(chatId, "Iltimos, video havolasini kiriting:");
    } else {
      bot.sendMessage(chatId, "Iltimos, rasm yuklang.");
    }
  } else if (state.step === "awaiting_video_url") {
    state.video_url = text;

    try {
      await pool.query(
        "INSERT INTO participants (name, surname, grade, classwork_text, image_path, video_url) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          state.name,
          state.surname,
          state.grade,
          state.classwork_text,
          state.image_path,
          state.video_url,
        ]
      );

      const message = `
    Yangi ishtirokchi qo'shildi:
    Ism: ${state.name} ${state.surname}
    Sinf: ${state.grade}
    Vazifa: ${state.classwork_text}
  `;

      await bot.sendPhoto(chatId, state.image_path, { caption: message });
      bot.sendMessage(chatId, "Ishtirokchi muvaffaqiyatli qo'shildi!");
    } catch (error) {
      console.error("Ishtirokchi qo'shishda xato:", error);
      bot.sendMessage(chatId, "Ishtirokchi qo'shish muvaffaqiyatsiz tugadi.");
    }

    delete userStates[chatId];
  }
});

async function getParticipants() {
  try {
    const result = await pool.query("SELECT * FROM participants");
    return result.rows;
  } catch (error) {
    console.error("Database query error:", error);
    throw new Error("Failed to fetch participants from the database.");
  }
}

// Command: Barcha ishtirokchilarni ko'rish
bot.onText(/👥 Ishtirokchilar/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const participants = await getParticipants();

    if (participants.length === 0) {
      return bot.sendMessage(chatId, "Hech qanday ishtirokchi topilmadi. 😔");
    }

    for (const participant of participants) {
      const message = `
👤 *Ism*: ${participant.name} ${participant.surname}
🏫 *Sinf*: ${participant.grade}
📝 *Vazifa*: ${participant.classwork_text}
      `;

      const videoButton = participant.video_url
        ? [
            {
              text: "🎥 Videoni ko'rish",
              url: participant.video_url,
            },
          ]
        : [];

      const voteKeyboard = {
        inline_keyboard: [
          videoButton,
          [
            {
              text: "🗳️ Ovoz berish",
              callback_data: `vote_${participant.id}`,
            },
            {
              text: "🔄 Ovozni qaytarish",
              callback_data: `revoke_${participant.id}`,
            },
          ],
        ],
      };

      if (participant.image_path) {
        await bot.sendPhoto(chatId, participant.image_path, {
          caption: message,
          reply_markup: voteKeyboard,
          parse_mode: "Markdown",
        });
      } else {
        await bot.sendMessage(chatId, message, {
          reply_markup: voteKeyboard,
          parse_mode: "Markdown",
        });
      }

      // Add a delay of 1 second between messages
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    await handleError(
      chatId,
      error,
      "Ishtirokchilarni olishda xatolik yuz berdi."
    );
  }
});

bot.onText(/🗳️ Ovoz berish/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const participants = await getParticipants();

    if (participants.length === 0) {
      return bot.sendMessage(chatId, "Hech qanday ishtirokchi topilmadi.");
    }

    // Create a keyboard with participants for voting
    const voteKeyboard = {
      inline_keyboard: participants.map((participant) => [
        {
          text: `${participant.name} ${participant.surname}`,
          callback_data: `vote_${participant.id}`,
        },
      ]),
    };

    // Send the list of participants
    bot.sendMessage(
      chatId,
      "Iltimos, ovoz berish uchun ishtirokchini tanlang:",
      {
        reply_markup: voteKeyboard,
      }
    );
  } catch (error) {
    console.error("Ishtirokchilarni olishda xato:", error);
    bot.sendMessage(chatId, "Ishtirokchilarni olish muvaffaqiyatsiz tugadi.");
  }
});

// Helper function to send the list of participants
async function sendParticipantsList(chatId) {
  try {
    const result = await pool.query(
      "SELECT id, name, surname FROM participants"
    );
    const participants = result.rows;

    if (participants.length === 0) {
      return bot.sendMessage(chatId, "Hech qanday ishtirokchi topilmadi.");
    }

    // Create a keyboard with participants for voting
    const voteKeyboard = {
      inline_keyboard: participants.map((participant) => [
        {
          text: `${participant.name} ${participant.surname}`,
          callback_data: `vote_${participant.id}`,
        },
      ]),
    };

    // Send the list of participants
    bot.sendMessage(
      chatId,
      "Iltimos, ovoz berish uchun ishtirokchini tanlang:",
      {
        reply_markup: voteKeyboard,
      }
    );
  } catch (error) {
    console.error("Ishtirokchilarni olishda xato:", error);
    bot.sendMessage(chatId, "Ishtirokchilarni olish muvaffaqiyatsiz tugadi.");
  }
}

// Command: Reytingni ko'rish (Admin uchun)

bot.onText(/🏆 Reyting/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const result = await pool.query(`
            SELECT p.name, p.surname, COUNT(v.id) AS vote_count
            FROM participants p
            LEFT JOIN votes v ON p.id = v.participant_id
            GROUP BY p.id
            ORDER BY vote_count DESC;
        `);

    const ranking = result.rows;

    if (ranking.length === 0) {
      return bot.sendMessage(chatId, "Hali hech qanday ovoz berilmagan. 😔");
    }

    let message = "🏆 *Reyting*:\n\n";
    ranking.forEach((row, index) => {
      message += `${index + 1}. ${row.name} ${row.surname} - ${
        row.vote_count
      } ovoz\n`;
    });

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Reytingni olishda xato:", error);
    bot.sendMessage(chatId, "Reytingni olish muvaffaqiyatsiz tugadi. 😔");
  }
});

// Command: Kanalga obuna holatini tekshirish
bot.onText(/✅ Obunani tekshirish/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const hasFollowed = await checkFollowStatus(userId);
  if (hasFollowed) {
    bot.sendMessage(
      chatId,
      "✅ Siz kanalga obuna bo'lgansiz. Ovoz berishingiz mumkin!"
    );
  } else {
    await sendChannelSubscriptionMessage(chatId, null, null);
  }
});

// Command: Ishtirokchini chetlashtirish (Admin uchun)
bot.onText(/❌ Ishtirokchini chetlatish/, async (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = await checkAdmin(chatId);
  if (!isAdmin) {
    return bot.sendMessage(
      chatId,
      "❌ Sizda bu buyruqni bajarish huquqi yo'q."
    );
  }

  try {
    const result = await pool.query(
      "SELECT id, name, surname FROM participants"
    );
    const participants = result.rows;

    if (participants.length === 0) {
      return bot.sendMessage(
        chatId,
        "Hozircha hech qanday ishtirokchi yo'q. 😔"
      );
    }

    const kickKeyboard = {
      inline_keyboard: participants.map((participant) => [
        {
          text: `❌ ${participant.name} ${participant.surname}`,
          callback_data: `kick_${participant.id}`,
        },
      ]),
    };

    bot.sendMessage(chatId, "Chetlashtirish uchun ishtirokchini tanlang:", {
      reply_markup: kickKeyboard,
    });
  } catch (error) {
    console.error("Ishtirokchilarni olishda xato:", error);
    bot.sendMessage(
      chatId,
      "Ishtirokchilarni olish muvaffaqiyatsiz tugadi. 😔"
    );
  }
});

// Command: Kanal qo'shish (Admin uchun)
bot.onText(/📢 Kanal qo'shish/, async (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = await checkAdmin(chatId);
  if (!isAdmin) {
    return bot.sendMessage(chatId, "Sizda bu buyruqni bajarish huquqi yo'q.");
  }

  userStates[chatId] = { step: "awaiting_channel_id" };
  bot.sendMessage(chatId, "Iltimos, kanal ID sini kiriting:");
});

// Kanal qo'shish uchun ko'p qadamli kirishni boshqarish
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!userStates[chatId]) return;

  const state = userStates[chatId];

  if (state.step === "awaiting_channel_id") {
    state.channel_id = text;
    state.step = "awaiting_channel_name";
    bot.sendMessage(chatId, "Iltimos, kanal nomini kiriting:");
  } else if (state.step === "awaiting_channel_name") {
    state.channel_name = text;

    try {
      await pool.query(
        "INSERT INTO channels (channel_id, channel_name) VALUES ($1, $2)",
        [state.channel_id, state.channel_name]
      );
      bot.sendMessage(chatId, "Kanal muvaffaqiyatli qo'shildi!");
    } catch (error) {
      console.error("Kanal qo'shishda xato:", error);
      bot.sendMessage(chatId, "Kanal qo'shish muvaffaqiyatsiz tugadi.");
    }

    delete userStates[chatId];
  }
});

console.log("Bot ishga tushdi...");
