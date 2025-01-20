const { identifyUser } = require("../utils/idenfy"); // Adjust the path as needed
const {
  InlineKeyboard,
  createParticipantButtons,
} = require("../utils/keyboard"); // Adjust the path as needed

class BotController {
  //- Handle the /start command

  static async handleStart(msg, bot) {
    const chatId = msg.chat.id;
    const { name, isAdmin } = identifyUser(msg);

    // Common commands for both users and admins
    let welcomeMessage = `
Assalomu alaykum ${isAdmin ? `Admin ${name}` : name}! 🎉

Ushbu bot orqali siz quyidagi amallarni bajarishingiz mumkin:

🗳️ *Ovoz berish:*
- \`ovoz berish\` - Qatnashuvchiga ovoz berish
- \`qaytarish\` - Ovozni bekor qilish

📊 *Reytingni ko'rish:*
- \`reyting\` - Reytingni ko'rish

Yordam olish uchun \`yordam\` komandasini ishlating.
  `;

    // Add admin-specific commands if the user is an admin
    if (isAdmin) {
      welcomeMessage += ` 

📝 *Qatnashuvchilarni qo'shish va ularni boshqarish:*
- \`kiritish\` - Qatnashuvchi qo'shish
- \`chetlatish\` - Qatnashuvchini o'chirish
- \`barcha qatnashuvchilar\` - Barcha qatnashuvchilarni ko'rish

📢 *Kanalni boshqarish:*
- \`kanal qo'shish\` - Kanal qo'shish
    `;
    }

    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
  }

  // - Handle the /yordam command

  static async handleHelp(msg, bot) {
    const chatId = msg.chat.id;
    const { name } = identifyUser(msg);

    const helpText = `
Assalomu alaykum, ${name}! 👋

Quyidagi komandalar yordamida botni boshqarishingiz mumkin:

🛠️ *Botni boshqarish:*
- \`/start\` - Botni ishga tushirish
- \`/help\` - Yordam ko'rsatish

🗳️ *Ovoz berish:*
- \`/vote <participant_id>\` - Qatnashuvchiga ovoz berish
- \`/revoke\` - Ovozni bekor qilish

📊 *Reyting:*
- \`/leaderboard\` - Reytingni ko'rish

Yordam olish uchun yuqoridagi komandalar orqali amallarni bajaring.
  `;

    await bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
  }
}

module.exports = BotController;
