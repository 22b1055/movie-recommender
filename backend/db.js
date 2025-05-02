// PostgreSQL DB connection
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a PostgreSQL connection pool using .env variables
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Export the pool to use in other files (e.g., routes.js)
module.exports = pool;
