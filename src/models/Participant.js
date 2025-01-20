const db = require("../config/db");

class Participant {
  // Fetch all participants
  static async findAll() {
    const sql = "SELECT * FROM participants;";
    return await db.fetchAll(sql);
  }

  // Fetch a participant by ID
  static async findById(id) {
    const sql = "SELECT * FROM participants WHERE id = $1;";
    return await db.fetchOne(sql, [id]);
  }

  // Create a new participant
  static async create(fullName, schoolGrade, description, imageUrl, videoLink) {
    const sql = `
      INSERT INTO participants (full_name, school_grade, description, image_url, video_link, vote_count)
      VALUES ($1, $2, $3, $4, $5, 0)
      RETURNING *;
    `;
    const params = [fullName, schoolGrade, description, imageUrl, videoLink];
    const result = await db.query(sql, params);
    console.log("Query result:", result.rows);

    return result.rows[0];
  }

  // Delete a participant by ID
  static async delete(id) {
    const sql = "DELETE FROM participants WHERE id = $1 RETURNING *;";
    return await db.query(sql, [id]);
  }

  // Increment the vote count for a participant
  static async incrementVoteCount(participantId) {
    const sql = `
      UPDATE participants
      SET vote_count = vote_count + 1
      WHERE id = $1
      RETURNING *;
    `;
    const params = [participantId];
    const result = await db.query(sql, params);
    return result.rows[0];
  }

  // Decrement the vote count for a participant
  static async decrementVoteCount(participantId) {
    const sql = `
      UPDATE participants
      SET vote_count = vote_count - 1
      WHERE id = $1
      RETURNING *;
    `;
    const params = [participantId];
    const result = await db.query(sql, params);
    return result.rows[0];
  }

  // Fetch all participants sorted by vote count in descending order
  static async findAllSortedByVotes() {
    const sql = `
      SELECT * FROM participants
      ORDER BY vote_count DESC;
    `;
    const result = await db.query(sql);
    return result.rows;
  }

  // -Delete all participants
  static async deleteAll() {
    const sql = "DELETE FROM participants;";
    return await db.query(sql);
  }
}

module.exports = Participant;
