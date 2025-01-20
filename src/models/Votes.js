const db = require("../config/db");

class Vote {
  /**
   * Creates a new vote.
   * @param {string} userId - ID of the user voting.
   * @param {string} participantId - ID of the participant being voted for.
   */
  static async create(userId, participantId) {
    const sql = `
      INSERT INTO votes (user_id, participant_id)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const params = [userId, participantId];
    return await db.query(sql, params);
  }

  /**
   * Check if the user has already voted for any participant.
   * @param {number} userId - The ID of the user.
   * @returns {boolean} - True if the user has voted, false otherwise.
   */
  static async hasUserVoted(userId) {
    const query = "SELECT * FROM votes WHERE user_id = $1";
    const result = await db.query(query, [userId]);
    return result.rows.length > 0;
  }

  // -Check if the user has already voted for a specific participant
  static async hasUserVotedForParticipant(userId, participantId) {
    const vote = await Vote.findByUserAndParticipant(userId, participantId);
    return !!vote; // Returns true if the user has voted for this participant
  }

  /**
   * Finds a vote by user ID and participant ID.
   * @param {string} userId - ID of the user.
   * @param {string} participantId - ID of the participant.
   */
  static async findByUserAndParticipant(userId, participantId) {
    const sql = `
      SELECT * FROM votes
      WHERE user_id = $1 AND participant_id = $2;
    `;
    const params = [userId, participantId];
    const result = await db.query(sql, params);
    return result.rows[0];
  }

  /**
   * Deletes a vote by ID.
   * @param {string} voteId - ID of the vote to delete.
   */
  static async delete(voteId) {
    const sql = `
      DELETE FROM votes
      WHERE id = $1;
    `;
    const params = [voteId];
    return await db.query(sql, params);
  }

  // -Delete all votes
  static async deleteAll() {
    const sql = "DELETE FROM votes;";
    return await db.query(sql);
  }
}

module.exports = Vote;
