const { getAuthAgent, createApplication, useTestDatabase } = require("../helpers");

useTestDatabase();

const XRW = ["X-Requested-With", "XMLHttpRequest"];

describe("PATCH /api/v1/applications/:id (editing)", () => {
  it("clears optional fields when they are sent as null", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent, { location: "Winnipeg, MB", salary_min: 60000 });

    const res = await agent
      .patch(`/api/v1/applications/${app.id}`)
      .set(...XRW)
      .send({ location: null, salary_min: null, notes: "Referred by Sam" });

    expect(res.status).toBe(200);
    expect(res.body.data.location).toBeNull();
    expect(res.body.data.salary_min).toBeNull();
    expect(res.body.data.notes).toBe("Referred by Sam");
  });

  it("rejects a salary range where the minimum is above the maximum", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent);

    const res = await agent
      .patch(`/api/v1/applications/${app.id}`)
      .set(...XRW)
      .send({ salary_min: 90000, salary_max: 70000 });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe("salary_max");
  });
});

describe("URL fields", () => {
  it("rejects javascript: links so they can't run code when clicked", async () => {
    const agent = await getAuthAgent();

    const res = await agent
      .post("/api/v1/applications")
      .set(...XRW)
      .send({ company: "Evil", role: "Dev", url: "javascript:alert(1)" });
    expect(res.status).toBe(422);

    const app = await createApplication(agent);
    const contact = await agent
      .post(`/api/v1/applications/${app.id}/contacts`)
      .set(...XRW)
      .send({ name: "Eve", linkedin_url: "javascript:alert(1)" });
    expect(contact.status).toBe(422);
  });
});

describe("Salary limits", () => {
  it("returns 422, not a server error, for an absurdly large salary", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent);

    const res = await agent
      .patch(`/api/v1/applications/${app.id}`)
      .set(...XRW)
      .send({ salary_max: 70000110000 });

    expect(res.status).toBe(422);
  });
});

describe("Salary range against saved values", () => {
  it("rejects a new minimum that is above the saved maximum", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent, { salary_min: 60000, salary_max: 70000 });

    const res = await agent
      .patch(`/api/v1/applications/${app.id}`)
      .set(...XRW)
      .send({ salary_min: 90000 });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe("salary_max");
  });

  it("allows raising the minimum when the maximum is cleared in the same request", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent, { salary_min: 60000, salary_max: 70000 });

    const res = await agent
      .patch(`/api/v1/applications/${app.id}`)
      .set(...XRW)
      .send({ salary_min: 90000, salary_max: null });

    expect(res.status).toBe(200);
  });

  it("rejects creating an application with minimum above maximum", async () => {
    const agent = await getAuthAgent();
    const res = await agent
      .post("/api/v1/applications")
      .set(...XRW)
      .send({ company: "Acme", role: "Dev", salary_min: 90000, salary_max: 70000 });

    expect(res.status).toBe(422);
  });
});
