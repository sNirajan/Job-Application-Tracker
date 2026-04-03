/*
 * Integration tests for auth endpoints.
 * Tests registration, login, refresh, and error cases.
 */

const request = require("supertest");
const app = require("../../src/app");
const db = require("../../src/config/database");

beforeAll(async () => {
  await db.migrate.latest();
});

afterEach(async () => {
  await db("application_events").del();
  await db("applications").del();
  await db("users").del();
});

afterAll(async () => {
  await db.destroy();
});

describe("POST /api/v1/auth/register", () => {
  it("should register a new user", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "new@test.com", password: "password123", name: "New User" });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.email).toBe("new@test.com");
    expect(res.body.data.name).toBe("New User");
    // Password hash should NEVER be in the response
    expect(res.body.data).not.toHaveProperty("password_hash");
  });

  it("should reject duplicate email", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "dupe@test.com", password: "password123", name: "First" });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "dupe@test.com", password: "password456", name: "Second" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("should reject password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "short@test.com", password: "1234567", name: "Short" });

    expect(res.status).toBe(422);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("should login and return tokens", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "login@test.com", password: "password123", name: "Login User" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "login@test.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    expect(res.body.data.user.email).toBe("login@test.com");
  });

  it("should reject wrong password", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "wrong@test.com", password: "password123", name: "User" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "wrong@test.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });

  it("should reject non-existent email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@test.com", password: "password123" });

    expect(res.status).toBe(401);
    // Same error message for both cases, no information leak
    expect(res.body.error.message).toBe("Invalid email or password");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("should return a new access token", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "refresh@test.com", password: "password123", name: "User" });

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "refresh@test.com", password: "password123" });

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: loginRes.body.data.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    
  });

  it("should reject an invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: "garbage-token-here" });

    expect(res.status).toBe(401);
  });
});