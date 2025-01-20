// src/utils/stateManager.js
const userStates = {};

function setUserState(userId, state) {
  userStates[userId] = state;
}

function getUserState(userId) {
  return userStates[userId];
}

function clearUserState(userId) {
  delete userStates[userId];
}

module.exports = {
  setUserState,
  getUserState,
  clearUserState,
};
