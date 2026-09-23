/*
 * Shared helpers for the integration tests of contacts, reminders
 * and documents.
 */

const request = require("supertest");
const app = require("../src/app");
const db = require("../src/config/database");

// Register + log in a user. The agent keeps the auth cookies.
async function getAuthAgent(email = "test@test.com") {
  const agent = request.agent(app);

  await agent
    .post("/api/v1/auth/register")
    .set("X-Requested-With", "XMLHttpRequest")
    .send({ email, password: "password123", name: "Test User" });

  await agent
    .post("/api/v1/auth/login")
    .set("X-Requested-With", "XMLHttpRequest")
    .send({ email, password: "password123" });

  return agent;
}

async function createApplication(agent, data = {}) {
  const res = await agent
    .post("/api/v1/applications")
    .set("X-Requested-With", "XMLHttpRequest")
    .send({ company: "Google", role: "Junior Developer", ...data });
  return res.body.data;
}

function useTestDatabase() {
  beforeAll(async () => {
    await db.migrate.latest();
  });

  // Deleting users cascades to applications and everything under them
  afterEach(async () => {
    await db("users").del();
  });

  afterAll(async () => {
    await db.destroy();
  });
}

module.exports = { app, db, request, getAuthAgent, createApplication, useTestDatabase };
