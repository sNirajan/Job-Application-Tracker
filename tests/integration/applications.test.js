/*
 * Integration tests for application endpoints.
 *
 * These test the FULL flow: HTTP request → route → middleware →
 * controller → service → database → response.
 *
 * We use Supertest, which takes your Express app and makes fake
 * HTTP requests against it in memory. No real server starts,
 * no port needed. That's why we split app.js from server.js.
 */

const request = require("supertest");
const app = require("../../src/app");
const db = require("../../src/config/database");

// --- Database lifecycle ---
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

// Helper: creates the fake user that matches our middleware's hardcoded UUID.
// Every test that hits a protected endpoint needs this user in the database.
async function createTestUser() {
  await db("users").insert({
    id: "00000000-0000-0000-0000-000000000001",
    email: "dev@test.com",
    password_hash: "placeholder",
    name: "Dev User",
  });
}

describe("POST /api/v1/applications", () => {
  it("should create an application with valid data", async () => {
    await createTestUser();

    const res = await request(app)
      .post("/api/v1/applications")
      .send({ company: "Google", role: "Junior Developer" });

    // Checks status code
    expect(res.status).toBe(201);

    // Checks response structure
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.company).toBe("Google");
    expect(res.body.data.role).toBe("Junior Developer");
    expect(res.body.data.status).toBe("wishlist");
  });

  it("should reject when company is missing", async () => {
    await createTestUser();

    const res = await request(app)
      .post("/api/v1/applications")
      .send({ role: "Junior Developer" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject when role is missing", async () => {
    await createTestUser();

    const res = await request(app)
      .post("/api/v1/applications")
      .send({ company: "Google" });

    expect(res.status).toBe(422);
  });
});

describe("GET /api/v1/applications", () => {
  it("should return empty array when no applications exist", async () => {
    await createTestUser();

    const res = await request(app).get("/api/v1/applications");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it("should return applications with pagination", async () => {
    await createTestUser();

    // Creates two applications
    await request(app)
      .post("/api/v1/applications")
      .send({ company: "Google", role: "Dev" });
    await request(app)
      .post("/api/v1/applications")
      .send({ company: "Shopify", role: "Dev" });

    const res = await request(app).get("/api/v1/applications");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.page).toBe(1);
  });

  it("should filter by status", async () => {
    await createTestUser();

    await request(app)
      .post("/api/v1/applications")
      .send({ company: "Google", role: "Dev", status: "applied" });
    await request(app)
      .post("/api/v1/applications")
      .send({ company: "Shopify", role: "Dev" }); // defaults to wishlist

    const res = await request(app).get("/api/v1/applications?status=applied");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].company).toBe("Google");
  });
});

describe("GET /api/v1/applications/:id", () => {
  it("should return a single application with available transitions", async () => {
    await createTestUser();

    // Creates one, then fetch it
    const created = await request(app)
      .post("/api/v1/applications")
      .send({ company: "Google", role: "Dev" });

    const res = await request(app)
      .get(`/api/v1/applications/${created.body.data.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.company).toBe("Google");
    expect(res.body.data.available_transitions).toEqual(["applied", "withdrawn"]);
  });

  it("should return 404 for non-existent application", async () => {
    await createTestUser();

    const res = await request(app)
      .get("/api/v1/applications/00000000-0000-0000-0000-000000000099");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/v1/applications/:id/status", () => {
  it("should allow valid status transition", async () => {
    await createTestUser();

    const created = await request(app)
      .post("/api/v1/applications")
      .send({ company: "Google", role: "Dev" });

    const res = await request(app)
      .patch(`/api/v1/applications/${created.body.data.id}/status`)
      .send({ status: "applied", notes: "Submitted resume" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("applied");
  });

  it("should block invalid status transition", async () => {
    await createTestUser();

    const created = await request(app)
      .post("/api/v1/applications")
      .send({ company: "Google", role: "Dev" });

    // Try to skip from wishlist to offer, state machine should block this
    const res = await request(app)
      .patch(`/api/v1/applications/${created.body.data.id}/status`)
      .send({ status: "offer" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should create a timeline event after transition", async () => {
    await createTestUser();

    const created = await request(app)
      .post("/api/v1/applications")
      .send({ company: "Google", role: "Dev" });

    await request(app)
      .patch(`/api/v1/applications/${created.body.data.id}/status`)
      .send({ status: "applied" });

    // Checks timeline has two events: creation + transition
    const timeline = await request(app)
      .get(`/api/v1/applications/${created.body.data.id}/timeline`);

    expect(timeline.status).toBe(200);
    expect(timeline.body.data).toHaveLength(2);
    expect(timeline.body.data[0].to_status).toBe("wishlist");
    expect(timeline.body.data[1].from_status).toBe("wishlist");
    expect(timeline.body.data[1].to_status).toBe("applied");
  });
});

describe("DELETE /api/v1/applications/:id", () => {
  it("should delete an application", async () => {
    await createTestUser();

    const created = await request(app)
      .post("/api/v1/applications")
      .send({ company: "Google", role: "Dev" });

    const res = await request(app)
      .delete(`/api/v1/applications/${created.body.data.id}`);

    expect(res.status).toBe(204);

    // Verify it's actually gone
    const check = await request(app)
      .get(`/api/v1/applications/${created.body.data.id}`);

    expect(check.status).toBe(404);
  });
});