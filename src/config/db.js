// src/config/db.js
const { Pool } = require("pg");
require("dotenv").config();

class Database {
  constructor() {
    // Initialize the PostgreSQL connection pool
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
    });

    // Test the connection on initialization
    this.testConnection();
  }

  // Test the database connection
  async testConnection() {
    try {
      const res = await this.pool.query("SELECT NOW()");
      console.log("Database connected successfully:", res.rows[0].now);
    } catch (err) {
      console.error("Error connecting to the database:", err);
      throw err; // Rethrow to stop the application if the connection fails
    }
  }

  // Execute a query with error handling
  async query(sql, params = []) {
    try {
      const res = await this.pool.query(sql, params);
      return res;
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow to handle errors in the calling function
    }
  }

  // Fetch a single row
  async fetchOne(sql, params = []) {
    try {
      const res = await this.pool.query(sql, params);
      return res.rows[0] || null;
    } catch (err) {
      console.error("Database fetchOne error:", err);
      throw err;
    }
  }

  // Fetch all rows
  async fetchAll(sql, params = []) {
    try {
      const res = await this.pool.query(sql, params);
      return res.rows;
    } catch (err) {
      console.error("Database fetchAll error:", err);
      throw err;
    }
  }

  // Close the database connection pool
  async close() {
    try {
      await this.pool.end();
      console.log("Database connection pool closed.");
    } catch (err) {
      console.error("Error closing the database connection pool:", err);
      throw err;
    }
  }
}

// Create a singleton instance of the Database class
const db = new Database();

module.exports = db;
