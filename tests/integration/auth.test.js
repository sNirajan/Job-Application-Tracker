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
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "new@test.com", password: "password123", name: "New User" });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.email).toBe("new@test.com");
    expect(res.body.data.name).toBe("New User");
    expect(res.body.data).not.toHaveProperty("password_hash");
    // Tokens should NOT be in the response body
    expect(res.body.data).not.toHaveProperty("accessToken");
    expect(res.body.data).not.toHaveProperty("refreshToken");
  });

  it("should reject duplicate email", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "dupe@test.com", password: "password123", name: "First" });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "dupe@test.com", password: "password456", name: "Second" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("should reject password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "short@test.com", password: "1234567", name: "Short" });

    expect(res.status).toBe(422);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("should login and set HttpOnly cookies", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "login@test.com", password: "password123", name: "Login User" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "login@test.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("login@test.com");
    // Tokens should be in cookies, NOT in the response body
    expect(res.body.data).not.toHaveProperty("accessToken");
    expect(res.body.data).not.toHaveProperty("refreshToken");
    // Check cookies are set
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith("accessToken="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
    // Verify HttpOnly flag
    expect(cookies.some((c) => c.includes("HttpOnly"))).toBe(true);
  });

  it("should reject wrong password", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "wrong@test.com", password: "password123", name: "User" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "wrong@test.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });

  it("should reject non-existent email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "nobody@test.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("should refresh the access token via cookies", async () => {
    const agent = request.agent(app);

    await agent
      .post("/api/v1/auth/register")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "refresh@test.com", password: "password123", name: "User" });

    await agent
      .post("/api/v1/auth/login")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "refresh@test.com", password: "password123" });

    const res = await agent
      .post("/api/v1/auth/refresh")
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(200);
    // New cookies should be set
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith("accessToken="))).toBe(true);
  });

  it("should reject without a refresh token cookie", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("should clear auth cookies", async () => {
    const agent = request.agent(app);

    await agent
      .post("/api/v1/auth/register")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "logout@test.com", password: "password123", name: "User" });

    await agent
      .post("/api/v1/auth/login")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "logout@test.com", password: "password123" });

    const res = await agent
      .post("/api/v1/auth/logout")
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(200);
    // Cookies should be cleared (maxAge=0)
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();

    // After logout, accessing protected route should fail
    const check = await agent.get("/api/v1/applications");
    expect(check.status).toBe(401);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("should return current user when authenticated", async () => {
    const agent = request.agent(app);

    await agent
      .post("/api/v1/auth/register")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "me@test.com", password: "password123", name: "Me User" });

    await agent
      .post("/api/v1/auth/login")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "me@test.com", password: "password123" });

    const res = await agent.get("/api/v1/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("me@test.com");
    expect(res.body.data.name).toBe("Me User");
    expect(res.body.data).not.toHaveProperty("password_hash");
  });

  it("should reject without authentication", async () => {
    const res = await request(app).get("/api/v1/auth/me");

    expect(res.status).toBe(401);
  });
});