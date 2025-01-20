const db = require("../config/db");

class Channel {
  // Fetch the first channel
  static async findRequiredChannel() {
    const sql = "SELECT * FROM channels LIMIT 1;";
    return await db.fetchOne(sql);
  }

  // Fetch all channels
  static async findAll() {
    const sql = "SELECT * FROM channels;";
    return await db.fetchAll(sql);
  }

  //-yangi kanal qo'shish

  static async create(channelId, channelName) {
    console.log(
      "Creating channel with ID:",
      channelId,
      "and name:",
      channelName
    );

    const sql = `
    INSERT INTO channels (channel_id, channel_name)
    VALUES ($1, $2)
    RETURNING *;
  `;
    const params = [channelId, channelName];

    try {
      const result = await db.query(sql, params);
      console.log("Query result:", result.rows);

      if (result.rows && result.rows.length > 0) {
        return result.rows[0]; // Return the inserted row
      } else {
        throw new Error("Failed to insert channel into the database.");
      }
    } catch (err) {
      console.error("Error creating channel:", err);
      throw err; // Re-throw the error to handle it in the controller
    }
  }

  // -Kanallarni o'chirish
  static async deleteAll() {
    const sql = "DELETE FROM channels;";
    return await db.query(sql);
  }
}

module.exports = Channel;
