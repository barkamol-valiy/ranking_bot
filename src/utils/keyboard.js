function Keyboard(isAdmin) {
  // Define the basic keyboard options
  const keyboard = [
    ["yordam"], // Show for all users
    ["barcha qatnashuvchilar"], // Show for all users
    ["ovoz berish", "qaytarish"], // Show for all users
    ["reyting"], // Show for all users
  ];

  // Add admin-specific buttons only if the user is an admin
  if (isAdmin) {
    keyboard.push(["kiritish", "chetlatish"]);
    keyboard.push(["kanal qo'shish"]);
    keyboard.push(["post"]);
  }

  return {
    reply_markup: {
      keyboard: keyboard,
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

// Dynamic inline keyboard for participants
function InlineKeyboard(participant) {
  const inlineKeyboard = [
    [
      {
        text: "Ovoz berish",
        callback_data: `vote_${participant.id}`,
      },
      {
        text: "Qaytarish",
        callback_data: `revoke_${participant.id}`,
      },
    ],
  ];

  // Add the video button only if the video_link is valid
  if (participant.video_link && isValidUrl(participant.video_link)) {
    inlineKeyboard.push([
      {
        text: "Videoni ko'rish",
        url: participant.video_link,
      },
    ]);
  }

  return {
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  };
}

// Helper function to validate URLs
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  InlineKeyboard,
};

function createParticipantButtons(participants, action = "vote") {
  return participants.map((participant) => [
    {
      text: participant.full_name,
      callback_data: `${action}_${participant.id}`,
    },
  ]);
}

module.exports = {
  Keyboard,
  InlineKeyboard,
  createParticipantButtons,
};
