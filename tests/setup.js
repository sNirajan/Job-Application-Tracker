/*
 * Test setup file.
 *
 * Runs migrations on the test database before any tests execute,
 * and tears everything down after. This ensures every test run
 * starts with a clean, properly structured database.
 */

const db = require("../src/config/database");

// Run migrations before all tests
beforeAll(async () => {
  await db.migrate.latest();
});

// Clean all table data between tests so they don't affect each other.
// Order matters, delete from child tables first (foreign keys).
afterEach(async () => {
  await db("application_events").del();
  await db("applications").del();
  await db("users").del();
});

// Close the database connection after all tests finish.
// Without this, Jest hangs because the connection pool stays open.
afterAll(async () => {
  await db.destroy();
});